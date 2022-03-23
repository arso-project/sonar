const DatSDK = require('hyper-sdk')
// TODO: Think about using the hyperspace daemon :-)
// const DatSDK = require('hyper-sdk/hyperspace')
const RAF = require('random-access-file')
const RAM = require('random-access-memory')
const p = require('path')
const level = require('level')
const levelMem = require('level-mem')
const sublevel = require('subleveldown')
const { promisify } = require('util')
const mkdirp = promisify(require('mkdirp-classic'))
const {
  NanoresourcePromise: Nanoresource
} = require('nanoresource-promise/emitter')
// const why = require('why-is-node-running')

const createLogger = require('@arsonar/common/log')

const Collection = require('./collection')
const LevelMap = require('./utils/level-map')
const {
  defaultStoragePath,
  maybeCallback,
  deriveId,
  resolveKeyOrName,
  discoveryKey,
  uuid
} = require('./util')

function defaultWorkspaceStoragePath () {
  return p.join(defaultStoragePath(), 'workspace', '_default')
}

module.exports = class Workspace extends Nanoresource {
  constructor (opts = {}) {
    super()
    this._opts = opts
    this._collections = new Map()
    this._leveldb = null
    this._leveldbs = new Map()
    this._storagePath = opts.storagePath || defaultWorkspaceStoragePath()
    this._opening = new Map()

    this.log = opts.log || createLogger()

    if (opts.defaultPlugins !== false) {
      const defaultPlugins = require('./default-plugins')
      for (const plugin of defaultPlugins) {
        this.registerPlugin(plugin)
      }
    }

    if (opts.plugins) {
      for (const plugin of opts.plugins) {
        this.registerPlugin(plugin)
      }
    }
  }

  get corestore () {
    return this._sdk._corestore
  }

  get network () {
    return this._sdk._swarm
  }

  get persist () {
    return this._opts.persist
  }

  ready (cb) {
    cb = maybeCallback(cb)
    this.open().then(cb, cb)
    return cb.promise
  }

  async _open () {
    if (!this._opts.sdk) {
      const sdkOpts = {
        ...this._opts,
        swarmOpts: this._opts.swarm || this._opts.swarmOpts
      }
      if (this._opts.persist === false) {
        sdkOpts.storage = RAM
      } else {
        sdkOpts.storage = file => RAF(this.storagePath('cores/' + file))
      }
      this._sdk = await DatSDK(sdkOpts)
      this._ownSDK = true
    } else {
      this._sdk = this._opts.sdk
      this._ownSDK = false
    }

    if (this._opts.persist === false) {
      this._leveldb = levelMem()
    } else {
      const path = this.storagePath('leveldb')
      await mkdirp(path)
      this._leveldb = level(path)
    }

    await this._leveldb.open()

    this._collectionInfo = new LevelMap(this.LevelDB('w/collections'))
    await this._collectionInfo.open()

    this._workspaceInfo = new LevelMap(this.LevelDB('w/workspace'))
    await this._workspaceInfo.open()

    this.id = this._workspaceInfo.get('id')
    if (this.id && this._opts.id && this._opts.id !== this.id) {
      throw new Error(
        `Opening workspace failed: ID mismatch(saved: ${this.id}, requested: ${this._opts.id}`
      )
    }
    if (!this.id) {
      this.id = this._opts.id || uuid()
      await this._workspaceInfo.setFlush('id', this.id)
    }

    // this._collectionStore = new SyncMap(this.LevelDB('w/collections'))
    // await this._collectionStore.open()
  }

  collections () {
    return Array.from(new Set(this._collections.values()))
  }

  async _close () {
    if (!this.opened) await this.open()
    await new Promise(resolve => process.nextTick(resolve))
    const promises = this.collections().map(c => c.close())
    await Promise.all(promises)
    await this._workspaceInfo.close()
    await this._collectionInfo.close()
    try {
      await this._leveldb.close()
    } catch (err) {}
    if (this._ownSDK) {
      await this._sdk.close()
    }
    this._sdk = null
    // this._sdk = null
    // this._leveldb = null
    // this._collections = new Map()
    this.emit('close')
  }

  async status () {
    if (!this.opened) await this.open()

    const collections = {}

    // 1. List all opened collections
    const openPromises = []
    for (const collection of this.collections()) {
      if (!collection.opened) openPromises.push(collection.open())
    }
    await Promise.all(openPromises)
    for (const collection of this.collections()) {
      const hkey = collection.key.toString('hex')
      collections[hkey] = collection.status()
    }

    // 2. List all not opened collections
    for (const info of this._collectionInfo.values()) {
      const key = info.key
      if (!collections[key]) {
        collections[key] = {
          localDrive: '',
          config: {},
          kappa: {},
          alias: null,
          feeds: [],
          network: {},
          opened: false,
          ...info
        }
      }
    }

    return { collections }
  }

  registerPlugin (plugin) {
    if (this.opened) process.nextTick(plugin, this)
    else this.once('opened', () => plugin(this))
  }

  async createCollection (keyOrName, opts = {}) {
    opts.create = true
    return this.openCollection(keyOrName, opts)
  }

  _findCollectionInfo (keyOrName) {
    return this._collectionInfo.find(info => {
      return info.key === keyOrName || info.name === keyOrName
    })
  }

  async _nameToKey (keyOrName) {
    const core = this.Hypercore(keyOrName)
    await core.ready()
    return core.key
  }

  async _localNameToKey (id, localName) {
    return this._nameToKey(`localwriter:${this.id}:${id}:${localName}`)
  }

  async openCollection (keyOrName, opts = {}) {
    if (Buffer.isBuffer(keyOrName)) keyOrName = keyOrName.toString('hex')
    if (this._collections.has(keyOrName)) {
      return this._collections.get(keyOrName)
    }
    if (opts.create && this._opening.has(keyOrName))
      this._opening.delete(keyOrName)

    if (!this._opening.has(keyOrName)) {
      const promise = this._openCollection(keyOrName, opts)
      this._opening.set(keyOrName, promise)
      if (opts.name) {
        this._opening.set(opts.name, promise)
      }
    }

    return this._opening.get(keyOrName)
  }

  async _openCollection (keyOrName, opts = {}) {
    // Resolve basic info
    let { key, name } = resolveKeyOrName(keyOrName)
    if (!key) {
      key = await this._nameToKey(name)
    }
    const id = deriveId(discoveryKey(key))

    const isLocalCreate = name && opts.create

    if (this._collections.has(id)) {
      return this._collections.get(id)
    }

    let info = this._findCollectionInfo(keyOrName)

    if (!info && !opts.create) {
      throw new Error('Collection does not exist')
    }

    if (!info) info = { key, name, id }

    let localKey = info.localKey
    if (!isLocalCreate && !localKey && info.writable !== false) {
      localKey = await this._localNameToKey('local')
    }
    if (!name && info.name) {
      name = info.name
    }

    opts.workspace = this
    opts.name = info.name
    opts.localKey = localKey

    const collection = new Collection(key, opts)

    this._collections.set(id, collection)
    this._collections.set(key, collection)
    this._collections.set(keyOrName, collection)

    collection.on('opening', awaitMe => {
      const hkey = collection.key.toString('hex')
      this._collections.set(hkey, collection)
      this._collections.set(collection.name, collection)
      this.emit('collection-opening', collection, awaitMe)
    })

    collection.on('open', () => {
      this.emit('collection-open', collection)
    })

    this.emit('collection', collection)
    await collection.open()
    this._opening.delete(keyOrName)
    this._opening.delete(collection.name)
    return collection
  }

  _saveCollection (collection, config) {
    const id = collection.id
    const status = collection.status()
    const lastInfo = this._collectionInfo.get(id) || {}
    const nextConfig = { ...(lastInfo.config || {}), ...config }
    const nextInfo = {
      name: status.name,
      key: status.key,
      id: status.id,
      localKey: status.localKey,
      discoveryKey: status.discoveryKey,
      rootKey: status.rootKey,
      config: nextConfig
    }
    this._collectionInfo.set(id, nextInfo)
  }

  _getCollectionConfig (collection) {
    const id = collection.id
    const info = this._collectionInfo.get(id)
    if (!info || !info.config) return null
    return { ...info.config }
  }

  storagePath (name) {
    return p.join(this._storagePath, name)
  }

  LevelDB (name, opts = {}) {
    if (this._leveldbs.has(name)) return this._leveldbs.get(name)
    const subdb = sublevel(this._leveldb, name, opts)
    this._leveldbs.set(name, subdb)
    return subdb
  }

  Hypercore (keyOrName, opts = {}) {
    if (opts.announce === undefined) {
      opts.announce = false
    }
    if (opts.lookup === undefined) {
      opts.lookup = false
    }
    const core = this._sdk.Hypercore(keyOrName, opts)
    core.setMaxListeners(128)
    return core
  }

  Hyperdrive (keyOrName, opts) {
    return this._sdk.Hyperdrive(keyOrName, opts)
  }

  // registerPlugin (name, handlers) {
  //   if (typeof handlers === 'function') {
  //     handlers = { oncollection: handlers }
  //   }
  //   this._plugins.set(name, handlers)
  // }
}

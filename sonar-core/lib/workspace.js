const DatSDK = require('dat-sdk')
const RAF = require('random-access-file')
const pino = require('pino')
const p = require('path')
const level = require('level')
const levelMem = require('level-mem')
const sublevel = require('subleveldown')
const { promisify } = require('util')
const mkdirp = promisify(require('mkdirp-classic'))
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
// const why = require('why-is-node-running')

const Collection = require('./collection')
const { maybeCallback, noop } = require('./util')

// Import for views - move into module.
const Catalog = require('@arso-project/sonar-tantivy')
const createSearchView = require('../views/search')
const Relations = require('@arso-project/sonar-view-relations')

function defaultStoragePath (opts) {
  const os = require('os')
  return p.join(os.homedir(), '.sonar')
}

function useSearch (workspace) {
  const indexCatalog = new Catalog(workspace.storagePath('tantivy'))
  workspace.on('collection', collection => {
    collection.once('opening', () => {
      const view = createSearchView(
        collection._leveldb('view/search'),
        null,
        { collection, indexCatalog }
      )
      collection.use('search', view)
    })
  })
  workspace.on('close', () => {
    indexCatalog.close()
  })
}

function useRelations (workspace) {
  const relations = new Relations(workspace.LevelDB('relations'))
  workspace.on('collection-open', collection => {
    collection.use('relations', relations.createView(collection))
  })
}

function useDefaultViews (workspace) {
  useSearch(workspace)
  useRelations(workspace)
}

module.exports = class Workspace extends Nanoresource {
  constructor (opts) {
    super()
    this._opts = opts
    this._collections = new Map()
    this._leveldb = null
    this._leveldbs = new Map()
    this._storagePath = opts.storagePath || defaultStoragePath()

    this.log = pino({
      level: 'debug',
      prettyPrint: true
    })

    this.registerPlugin(useDefaultViews)
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
      const sdkOpts = { ...this._opts }
      sdkOpts.storage = file => RAF(this.storagePath('cores/' + file))
      this._sdk = await DatSDK(sdkOpts)
      this._ownSDK = true
    } else {
      this._sdk = this._opts.sdk
    }

    if (this._opts.persist === false) {
      this._leveldb = levelMem()
    } else {
      const path = this.storagePath('leveldb')
      await mkdirp(path)
      this._leveldb = level(path)
    }

    await this._leveldb.open()

    // this._collectionStore = new SyncMap(this.LevelDB('w/collections'))
    // await this._collectionStore.open()
  }

  collections () {
    return Array.from(this._collections.values())
  }

  async _close () {
    if (!this.opened) await this.open()
    this.emit('closing')
    await new Promise(resolve => process.nextTick(resolve))
    const promises = this.collections().map(c => c.close())
    await Promise.all(promises)
    this._leveldb.close()
    if (this._ownSDK) {
      await this._sdk.close()
    }
    // this._sdk = null
    // this._leveldb = null
    // this._collections = new Map()
    this.emit('close')
  }

  registerPlugin (plugin) {
    if (this.opened) plugin(this)
    else this.once('opened', () => plugin(this))
  }

  Collection (keyOrName, opts = {}) {
    if (this._collections.has(keyOrName)) {
      return this._collections.get(keyOrName)
    }

    opts.workspace = this

    const collection = new Collection(keyOrName, opts)
    this._collections.set(collection._keyOrName, collection)

    collection.once('open', () => {
      this._collections.set(collection.key.toString('hex'), collection)
      process.nextTick(() => {
        this.emit('collection-open', collection)
      })
    })

    this.emit('collection', collection)

    return collection
  }

  async openCollection (keyOrName, opts = {}) {
    const collection = this.Collection(keyOrName, opts)
    await collection.open()
    return collection
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

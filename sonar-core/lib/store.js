const p = require('path')
const os = require('os')
const datEncoding = require('dat-encoding')
const fs = require('fs')
const crypto = require('hypercore-crypto')
const sub = require('subleveldown')
const mkdirp = require('mkdirp-classic')
const thunky = require('thunky')
const leveldb = require('level')
const debug = require('debug')('sonar-core')
const Corestore = require('corestore')
const SwarmNetworker = require('corestore-swarm-networking')
const Nanoresource = require('nanoresource/emitter')

const Scopes = require('kappa-scopes')
const Catalog = require('@arso-project/sonar-tantivy')
const Relations = require('@arso-project/sonar-view-relations')

const Config = require('./config')
const Collection = require('./collection')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class CollectionStore extends Nanoresource {
  constructor (storage, opts = {}) {
    super()
    storage = storage || p.join(os.homedir(), '.sonar')
    this.paths = {
      base: storage,
      corestore: p.join(storage, 'corestore'),
      level: p.join(storage, 'level'),
      tantivy: p.join(storage, 'tantivy')
    }
    this.opts = opts
    if (!this.opts.swarm) this.opts.swarm = {}

    // Actual initialization of resources happens in this._open()

    this.collections = {}
    this.ready = this.open.bind(this)
    this.open()
  }

  _ensurePaths (cb) {
    cb = once(cb)
    let pending = Object.values(this.paths).length
    for (const path of Object.values(this.paths)) {
      fs.stat(path, (err, stat) => {
        if (err && err.code !== 'ENOENT') return cb(err)
        if (err) {
          mkdirp(path, err => {
            if (err) return cb(err)
            done()
          })
        } else if (!stat.isDirectory()) {
          return cb(new Error('Not a directory: ' + path))
        } else done()
      })
    }
    function done () {
      if (--pending === 0) cb()
    }
  }

  _open (cb) {
    debug('storage location: ' + this.paths.base)
    this._ensurePaths(err => {
      if (err) return cb(err)

      this.config = new Config(p.join(this.paths.base, 'config.json'))
      this.corestore = new Corestore(this.paths.corestore)
      this.indexCatalog = new Catalog(this.paths.tantivy, {
        log: require('debug')('sonar-tantivy')
      })
      this.indexCatalog.on('error', err => {
        this.emit('error', err)
      })

      this.level = leveldb(this.paths.level)

      this._dbs = {
        scopes: sub(this.level, 's'),
        relations: sub(this.level, 'r')
      }

      this.scopes = new Scopes({
        corestore: this.corestore,
        db: this._dbs.scopes
      })

      this.relations = new Relations(this._dbs.relations)

      if (this.opts.network !== false) {
        this.network = new SwarmNetworker(this.corestore, {
          announceLocalAddress: true,
          ...this.opts.swarm
        })
      }

      this.config.load((err, config) => {
        if (err) return cb(err)
        debug('config loaded', this.config.path)
        this.corestore.ready(err => {
          if (err) return cb(err)
          // this.scopes.open(err => {
          // })
          if (err) return cb(err)
          this._onready(config, cb)
        })
      })
    })
  }

  _onready (config, cb) {
    if (config.collections) {
      for (const info of Object.values(config.collections)) {
        const collection = this._openCollection(info.key, info)
        if (info.share) {
          collection.ready(() => this.share(collection.key))
        }
      }
    }
    this.opened = true
    cb()
  }

  status (cb) {
    if (!this.opened) return this.ready(() => this.status(cb))

    const status = { storage: this.storagePath, collections: {} }

    // TODO: This opens all collections. Likely we do not want to do this in all cases.
    let pending = Object.keys(this.collections).length + 1
    for (const [key, collection] of Object.entries(this.collections)) {
      collection.ready(() => {
        const collectionConfig = this.getCollectionConfig(key)
        collection.status((err, collectionStatus) => {
          if (err) return cb(err)
          status.collections[key] = {
            key,
            network: {},
            ...collectionConfig,
            // config: collectionConfig,
            ...collectionStatus
          }
          if (this.network) {
            status.collections[key].network = this.network.status(collection.discoveryKey)
          }
          finish()
        })
      })
    }
    finish()

    function finish () {
      if (--pending !== 0) return
      cb(null, status)
    }
  }

  create (name, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    let { key, alias } = opts
    if (!name || !name.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid collection name'))
    if (!key && !alias) alias = name
    if (!alias) return cb(new Error('alias is required'))
    if (!alias.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid alias'))

    // TODO: Validate key.
    if (key) key = Buffer.from(key, 'hex')
    this._collectionByName(name, (err, info) => {
      if (err) return cb(err)
      if (info) return cb(new Error('collection exists'))
      this._create(name, { key, alias }, cb)
    })
  }

  _create (name, { key, alias }, cb = noop) {
    const collection = this._openCollection(key || null, { name, alias })
    collection.ready(err => {
      if (err) return cb(err)
      const info = {
        key: hex(collection.key),
        name,
        alias,
        // TODO: Add opt to not share collection when creating
        share: true
      }
      this.updateCollection(collection.key, info, err => {
        if (err) return cb(err)
        cb(null, collection)
      })
    })
  }

  get (keyOrName, opts, cb) {
    if (!cb && typeof opts === 'function') return this.get(keyOrName, {}, opts)

    if (isKey(keyOrName)) {
      const key = hex(keyOrName)
      this._collectionByKey(key, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`collection ${keyOrName} does not exist.`))
        const collection = this._openCollection(info.key, info)
        collection.ready(() => cb(null, collection))
      })
    } else {
      this._collectionByName(keyOrName, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`collection ${keyOrName} does not exist.`))
        const collection = this._openCollection(info.key, info)
        collection.ready(() => cb(null, collection))
      })
    }
  }

  list (cb) {
    this.config.load((err, config) => {
      err ? cb(err) : cb(null, config.collections)
    })
  }

  share (key) {
    if (!this.network) return
    key = hex(key)
    if (!this.collections[key]) return
    const collection = this.collections[key]
    this.network.join(collection.discoveryKey)
    debug('join swarm for discoveryKey %s', collection.discoveryKey.toString('hex'))
    collection.fs.status((err, info) => {
      if (err) return
      for (const { discoveryKey } of Object.values(info)) {
        this.network.join(Buffer.from(discoveryKey, 'hex'))
      }
    })
  }

  unshare (key, cb) {
    if (!this.network) return
    key = hex(key)
    if (!this.collections[key]) return
    const collection = this.collections[key]
    debug('leave swarm for discoveryKey %s', collection.discoveryKey.toString('hex'))
    this.network.leave(collection.discoveryKey)
  }

  updateCollection (key, info, cb) {
    key = hex(key)
    if (!this.collections[key]) return cb(new Error('Collection does not exist'))
    if (info.share !== undefined) {
      if (info.share) {
        this.share(key)
      } else {
        this.unshare(key)
      }
    }
    this.config.update(config => {
      if (!config.collections) config.collections = {}
      if (!config.collections[key]) config.collections[key] = {}
      config.collections[key] = { ...config.collections[key], ...info }
      return config
    }, cb)
  }

  getCollectionConfig (key) {
    try {
      return this.config.getKey(['collections', key])
    } catch (err) {
      return {}
    }
  }

  _close (cb) {
    const self = this
    this.emit('close')

    let collectionspending = Object.values(this.collections).length + 1
    debug(`waiting for ${collectionspending - 1} collections to close`)
    for (const collection of Object.values(this.collections)) {
      collection.close(oncollectionclosed)
    }
    oncollectionclosed()

    function oncollectionclosed () {
      if (--collectionspending !== 0) return

      let pending = 0
      self.indexCatalog.close(onclose('index catalog'))
      self.config.close(onclose('config'))
      self.corestore.close(onclose('corestore'))
      self.level.close(onclose('leveldb'))

      function onclose (name, err) {
        debug(`waiting for ${name} to close`)
        ++pending
        return function () {
          process.nextTick(onservicesclosed.bind(null, name))
        }
      }

      function onservicesclosed (name, err) {
        debug(`closed ${name}`)
        if (err) debug(err)
        if (--pending !== 0) return
        closenetwork()
      }

      function closenetwork () {
        if (self.network) {
          debug('waiting for network to close')
          self.network.close().then(finish).catch(finish)
        } else {
          finish()
        }
      }

      function finish (err) {
        if (err) debug(err)
        debug('closed everything')
        cb()
      }
    }
  }

  _collectionByName (name, cb) {
    this.config.load((err, config) => {
      if (err || !config.collections) return cb(err)
      const result = Object.values(config.collections).find(v => v.name === name)
      return cb(null, result)
    })
  }

  _collectionByKey (key, cb) {
    this.config.load((err, config) => {
      if (err || !config.collections) return cb(err)
      const result = config.collections[key]
      cb(null, result)
    })
  }

  _openCollection (key, opts) {
    if (typeof opts === 'function') return this._openCollection(key, {}, opts)
    let create = false

    // No key means create a new collection. We need the key for the storage path,
    // so first create a new writable feed.
    if (!key) {
      const feed = this.corestore.get()
      key = feed.key
      create = true
    }

    key = hex(key)
    if (this.collections[key]) return this.collections[key]

    const scopeOpts = {
      name: opts.name,
      key,
      // rootFeedKey: key,
      defaultFeedType: 'sonar.db'
    }

    // const scope = this.scopes.createScopeWithRootFeed(scopeOpts)
    const scope = this.scopes.get(scopeOpts)

    const collectionOpts = {
      ...opts,
      key,
      scope,
      indexCatalog: this.indexCatalog,
      relations: this.relations,
      level: sub(this.level, key)
    }
    const collection = new Collection(key, collectionOpts)

    this.collections[key] = collection

    if (create) {
      collection.ready(() => {
        collection.init(() => {
          // TODO: do anything?
          debug('init collection key %s name %s alias %s', collection.key.toString('hex'), opts.name, opts.alias)
        })
      })
    }
    return collection
  }
}

function hex (key) {
  return Buffer.isBuffer(key) ? key.toString('hex') : key
}

function isKey (key) {
  if (!(key instanceof Buffer || typeof key === 'string')) return false
  if (typeof key === 'string') key = Buffer.from(key, 'hex')
  return key.length === 32
}

function noop () {}

function once (fn) {
  let called = false
  return (...args) => {
    if (called) return
    called = true
    fn(...args)
  }
}

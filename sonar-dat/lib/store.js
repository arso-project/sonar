const p = require('path')
const os = require('os')
const crypto = require('hypercore-crypto')
const sub = require('subleveldown')
const mkdirp = require('mkdirp')
const thunky = require('thunky')
const leveldb = require('level')
const debug = require('debug')('sonar-dat')
const { EventEmitter } = require('events')
const Corestore = require('corestore')
const Catalog = require('@arso-project/sonar-tantivy')

const Config = require('./config')
const Network = require('./network')
const Island = require('./island')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class IslandStore extends EventEmitter {
  constructor (storage, opts = {}) {
    super()
    storage = storage || p.join(os.homedir(), '.sonar')
    this.paths = {
      base: storage,
      corestore: p.join(storage, 'corestore'),
      level: p.join(storage, 'level'),
      tantivy: p.join(storage, 'tantivy')
    }

    Object.values(this.paths).forEach(p => mkdirp.sync(p))

    if (opts.network !== false) {
      this.network = new Network({
        announceLocalAddress: true
      })
    } else {
      this.network = new Network.NoNetwork()
    }

    this.config = new Config(p.join(this.paths.base, 'config.json'))
    this.corestore = new Corestore(this.paths.corestore)
    this.indexCatalog = new Catalog(this.paths.tantivy)
    this.indexCatalog.on('error', err => {
      this.emit('error', err)
    })
    this.level = leveldb(this.paths.level)

    debug('storage location: ' + this.paths.base)

    this.islands = {}
    this.opened = false
    this.ready = thunky(this._ready.bind(this))
    this.ready()
  }

  _ready (cb) {
    this.config.load((err, config) => {
      if (err) return cb(err)
      this.corestore.ready((err) => {
        if (err) return cb(err)
        debug('config loaded', this.config.path)
        if (config.islands) {
          for (const info of Object.values(config.islands)) {
            if (info.share) {
              const island = this._open(info.key, info)
              this.network.add(island)
            }
          }
        }
        this.opened = true
        cb()
      })
    })
  }

  status (cb) {
    this.config.load((err, config) => {
      if (err) return cb(err)
      this.network.status((err, networkStatus) => {
        if (err) return cb(err)
        const islands = {}
        if (config.islands) {
          Object.values(config.islands).forEach(island => {
            const { key } = island
            if (this.islands[key]) {
              island.localKey = this.islands[key].db.localKey.toString('hex')
              island.localDrive = this.islands[key].fs.localwriter.key.toString('hex')
            }
            islands[island.key] = island
          })
        }
        cb(null, {
          storage: this.storagePath,
          islands,
          // config: config,
          network: networkStatus
        })
      })
    })
  }

  create (name, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    let { key, alias } = opts
    if (!name || !name.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid island name'))
    if (!key && !alias) alias = name
    if (!alias) return cb(new Error('alias is required'))
    if (!alias.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid alias'))

    // TODO: Validate key.
    if (key) key = Buffer.from(key, 'hex')
    this._islandByName(name, (err, info) => {
      if (err) return cb(err)
      if (info) return cb(new Error('island exists'))
      this._create(name, { key, alias }, cb)
    })
  }

  _create (name, { key, alias }, cb = noop) {
    const island = this._open(key || null, { name, alias })
    island.ready(err => {
      if (err) return cb(err)
      const info = {
        key: hex(island.key),
        name,
        alias,
        // TODO: Add opt to not share island when creating
        share: true
      }
      this._saveIsland(info, err => cb(err, island))
      if (info.share) this.share(island.key)
    })
  }

  get (keyOrName, opts, cb) {
    if (!cb && typeof opts === 'function') return this.get(keyOrName, {}, opts)

    if (isKey(keyOrName)) {
      const key = hex(keyOrName)
      this._islandByKey(key, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`island ${keyOrName} does not exist.`))
        const island = this._open(info.key, info)
        island.ready(() => cb(null, island))
      })
    } else {
      this._islandByName(keyOrName, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`island ${keyOrName} does not exist.`))
        const island = this._open(info.key, info)
        island.ready(() => cb(null, island))
      })
    }
  }

  list (cb) {
    this.config.load((err, config) => {
      err ? cb(err) : cb(null, config.islands)
    })
  }

  share (key, cb) {
    key = hex(key)
    if (!this.islands[key]) return
    this.network.add(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = true
      return config
    }, cb)
  }

  unshare (key, cb) {
    key = hex(key)
    if (!this.islands[key]) return
    this.network.remove(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = false
      return config
    }, cb)
  }

  updateIsland (key, config, cb) {
    console.log('UPDATE', key, config)
    if (config.share) {
      return this.share(key, cb)
    } else {
      return this.unshare(key, cb)
    }
  }

  close (cb) {
    const self = this

    let pending = Object.values(this.islands).length + 1
    for (const island of Object.values(this.islands)) {
      island.close(finish)
    }
    finish()

    function finish () {
      if (--pending !== 0) return
      debug('close all services')
      self.indexCatalog.close(() => {
        debug('closed: index catalog')
        self.config.close(() => {
          debug('closed: config')
          self.network.close(() => {
            debug('closed: network')
            self.corestore.close(() => {
              debug('closed: corestore')
              debug('all closed')
              cb()
            })
          })
        })
      })
    }
  }

  _saveIsland (info, cb) {
    let { key, name } = info
    key = hex(key)
    this.config.update(config => {
      config.islands = config.islands || {}
      config.islands[key] = { name, key }
      return config
    }, cb)
  }

  _islandByName (name, cb) {
    this.config.load((err, config) => {
      if (err || !config.islands) return cb(err)
      const result = Object.values(config.islands).find(v => v.name === name)
      return cb(null, result)
    })
  }

  _islandByKey (key, cb) {
    this.config.load((err, config) => {
      if (err || !config.islands) return cb(err)
      const result = config.islands[key]
      cb(null, result)
    })
  }

  _open (key, opts) {
    if (typeof opts === 'function') return this._open(key, {}, opts)
    let create = false
    // No key means create a new island. We need the key for the storage path,
    // so first create a new writable feed.
    if (!key) {
      const feed = this.corestore.get()
      key = feed.key
      create = true
    }

    key = hex(key)
    if (this.islands[key]) return this.islands[key]

    // const storagePath = p.join(this.storagePath, 'island', key)
    const namespacedCorestore = this.corestore.namespace(key)
    const islandOpts = {
      ...opts,
      corestore: namespacedCorestore,
      indexCatalog: this.indexCatalog,
      level: sub(this.level, key)
    }
    const island = new Island(key, islandOpts)

    this.islands[key] = island
    // else island.ready(() => (this.islands[hex(island.key)] = island))

    if (create) {
      island.ready(() => {
        island.init(() => {
          // TODO: do anything?
          debug('init island key %s name %s alias %s', island.key.toString('hex'), opts.name, opts.alias)
        })
      })
    }
    return island
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

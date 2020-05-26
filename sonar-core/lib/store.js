const p = require('path')
const os = require('os')
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

const Catalog = require('@arso-project/sonar-tantivy')
const Relations = require('@arso-project/sonar-view-relations')

const Config = require('./config')
const Island = require('./island')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class IslandStore extends Nanoresource {
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

    // Actual initialization of resources happens in this._open()

    this.islands = {}
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

      this.relations = new Relations(sub(this.level, '_r'))

      if (this.opts.network !== false) {
        this.network = new SwarmNetworker(this.corestore, {
          announceLocalAddress: true
        })
      }

      this.config.load((err, config) => {
        if (err) return cb(err)
        debug('config loaded', this.config.path)
        this.corestore.ready((err) => {
          if (err) return cb(err)
          else this._onready(config, cb)
        })
      })
    })
  }

  _onready (config, cb) {
    if (config.islands) {
      for (const info of Object.values(config.islands)) {
        const island = this._openIsland(info.key, info)
        if (info.share) {
          island.ready(() => this.share(island.key))
        }
      }
    }
    this.opened = true
    cb()
  }

  status (cb) {
    if (!this.opened) return this.ready(() => this.status(cb))

    const status = { storage: this.storagePath, islands: {} }

    // TODO: This opens all islands. Likely we do not want to do this in all cases.
    let pending = Object.keys(this.islands).length + 1
    for (const [key, island] of Object.entries(this.islands)) {
      island.ready(() => {
        const islandConfig = this.getIslandConfig(key)
        island.status((err, islandStatus) => {
          if (err) return cb(err)
          status.islands[key] = {
            key,
            network: {},
            ...islandConfig,
            // config: islandConfig,
            ...islandStatus
          }
          if (this.network) {
            status.islands[key].network = this.network.status(island.discoveryKey)
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
    const island = this._openIsland(key || null, { name, alias })
    island.ready(err => {
      if (err) return cb(err)
      const info = {
        key: hex(island.key),
        name,
        alias,
        // TODO: Add opt to not share island when creating
        share: true
      }
      this.updateIsland(island.key, info, err => {
        if (err) return cb(err)
        cb(null, island)
      })
    })
  }

  get (keyOrName, opts, cb) {
    if (!cb && typeof opts === 'function') return this.get(keyOrName, {}, opts)

    if (isKey(keyOrName)) {
      const key = hex(keyOrName)
      this._islandByKey(key, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`island ${keyOrName} does not exist.`))
        const island = this._openIsland(info.key, info)
        island.ready(() => cb(null, island))
      })
    } else {
      this._islandByName(keyOrName, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`island ${keyOrName} does not exist.`))
        const island = this._openIsland(info.key, info)
        island.ready(() => cb(null, island))
      })
    }
  }

  list (cb) {
    this.config.load((err, config) => {
      err ? cb(err) : cb(null, config.islands)
    })
  }

  share (key) {
    console.log('share', key)
    if (!this.network) return
    console.log('a')
    key = hex(key)
    if (!this.islands[key]) return
    console.log('b')
    const island = this.islands[key]
    this.network.join(island.discoveryKey)
    debug('join swarm for discoveryKey %s', island.discoveryKey.toString('hex'))
    island.fs.status((err, info) => {
      if (err) return
      for (const { discoveryKey } of Object.values(info)) {
        this.network.join(Buffer.from(discoveryKey, 'hex'))
      }
    })

    // this.network.add(this.islands[key])
  }

  unshare (key, cb) {
    if (!this.network) return
    key = hex(key)
    if (!this.islands[key]) return
    const island = this.islands[key]
    debug('leave swarm for discoveryKey %s', island.discoveryKey.toString('hex'))
    this.network.leave(island.discoveryKey)
  }

  updateIsland (key, info, cb) {
    key = hex(key)
    if (!this.islands[key]) return cb(new Error('Island does not exist'))
    if (info.share !== undefined) {
      if (info.share) {
        this.share(key)
      } else {
        this.unshare(key)
      }
    }
    this.config.update(config => {
      if (!config.islands) config.islands = {}
      if (!config.islands[key]) config.islands[key] = {}
      config.islands[key] = { ...config.islands[key], ...info }
      return config
    }, cb)
  }

  getIslandConfig (key) {
    try {
      return this.config.getKey(['islands', key])
    } catch (err) {
      return {}
    }
  }

  _close (cb) {
    const self = this
    this.emit('close')

    let islandspending = Object.values(this.islands).length + 1
    debug(`waiting for ${islandspending} islands to close`)
    for (const island of Object.values(this.islands)) {
      island.close(onislandclosed)
    }
    onislandclosed()

    function onislandclosed () {
      if (--islandspending !== 0) return

      let pending = 0
      self.indexCatalog.close(onclose('index catalog'))
      self.config.close(onclose('config'))
      if (self.network) {
        const close = onclose('network')
        self.network.close().then(close)
      }
      self.corestore.close(onclose('corestore'))
      self.level.close(onclose('leveldb'))

      function onclose (name) {
        debug(`waiting for ${name} to close`)
        ++pending
        return function () {
          process.nextTick(finish)
        }
      }

      function finish () {
        if (--pending !== 0) return
        debug('closed everything')
        cb()
      }
    }
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

  _openIsland (key, opts) {
    if (typeof opts === 'function') return this._openIsland(key, {}, opts)
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
      relations: this.relations,
      level: sub(this.level, key)
    }
    const island = new Island(key, islandOpts)

    this.islands[key] = island

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

function once (fn) {
  let called = false
  return (...args) => {
    if (called) return
    called = true
    fn(...args)
  }
}

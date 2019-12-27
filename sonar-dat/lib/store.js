const p = require('path')
const os = require('os')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')
const debug = require('debug')('sonar-dat')
const Corestore = require('corestore')

const Config = require('./config')
const Network = require('./network')
const Island = require('./island')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class IslandStore {
  constructor (storage) {
    storage = storage || p.join(os.homedir(), '.sonar')
    this.storagePath = p.resolve(storage)
    this.network = new Network({
      announceLocalAddress: true
    })

    const configPath = p.join(this.storagePath, 'config.json')
    this.config = new Config(configPath)

    this.corestore = new Corestore(p.join(this.storagePath, 'corestore'))

    debug('islands storage path: ' + this.storagePath)

    this.islands = {}
    this.opened = false
    this.ready = thunky(this._ready.bind(this))
    this.ready()
  }

  _ready (cb) {
    this.corestore.ready(() => {
      this.config.load((err, config) => {
        if (err) return cb(err)
        debug('config loaded', this.config.path)
        if (!config.islands) return cb()
        for (const info of Object.values(config.islands)) {
          if (info.share) {
            const island = this._open(info.key, info)
            this.network.add(island)
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
        cb(null, {
          storage: this.storagePath,
          islands: config.islands,
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
    if (!name || !name.match(ISLAND_NAME_REGEX)) return cb(new Error('Invalid island name'))
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

  share (key) {
    key = hex(key)
    if (!this.islands[key]) return
    this.network.add(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = true
      return config
    })
  }

  unshare (key) {
    key = hex(key)
    if (!this.islands[key]) return
    this.network.remove(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = false
      return config
    })
  }

  close (cb) {
    for (const island of Object.values(this.islands)) {
      island.close()
    }
    this.config.close(() => {
      this.network.close(cb)
    })
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

    const storagePath = p.join(this.storagePath, 'island', key)
    const namespacedCorestore = this.corestore.namespace(key)
    const islandOpts = {
      ...opts,
      corestore: namespacedCorestore
    }
    const island = new Island(storagePath, key, islandOpts)

    this.islands[key] = island
    // else island.ready(() => (this.islands[hex(island.key)] = island))

    if (create) {
      island.ready(() => {
        island.init(() => {
          // TODO: do anything?
          debug('init island key %s name %s alias %s', island.key, opts.name, opts.alias)
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

const p = require('path')
const os = require('os')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')
const debug = require('debug')('sonar-dat')

const Config = require('./config')
const Network = require('./network')
const Island = require('./island')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class IslandStore {
  constructor (storage) {
    storage = storage || p.join(os.homedir(), '.sonar')
    this.storagePath = p.resolve(storage)
    this.network = new Network()

    const configPath = p.join(this.storagePath, 'config.json')
    this.config = new Config(configPath)

    debug('islands storage path: ' + this.storagePath)

    this.islands = {}
    this.ready = thunky(this._ready.bind(this))
    this.ready()
  }

  _ready (cb) {
    this.config.load((err, config) => {
      if (err) return cb(err)
      if (!config.islands) return cb()
      for (const info of Object.values(config.islands)) {
        if (info.share) {
          const island = this._open(info.key, info)
          this.network.add(island)
        }
      }
      cb()
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

  create (name, key, cb) {
    if (typeof key === 'function') return this.create(name, null, key)
    if (!name || !name.match(ISLAND_NAME_REGEX)) return cb(new Error('Invalid island name'))
    // TODO: Validate key.
    if (key) key = Buffer.from(key, 'hex')
    this._islandByName(name, (err, info) => {
      if (err) return cb(err)
      if (info) return cb(new Error('island exists'))
      this._create({ name, key }, cb)
    })
  }

  _create ({ name, key }, cb) {
    let keyPair
    if (!key) {
      keyPair = crypto.keyPair()
      key = keyPair.publicKey
    }
    const island = this._open(key, { keyPair, name })
    island.name = name
    island.ready(err => {
      if (err) return cb(err)
      const info = {
        key,
        name,
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
        if (!info && opts.create) return this._create({ key }, cb)
        if (!info) return cb(new Error('Island does not exist'))
        const island = this._open(info.key, info)
        cb(null, island)
      })
    } else {
      const name = keyOrName
      this._islandByName(keyOrName, (err, info) => {
        if (err) return cb(err)
        if (!info && opts.create) return this._create({ name }, cb)
        if (!info) return cb(new Error('Island does not exist'))
        const island = this._open(info.key, info)
        cb(null, island)
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
    this.network.close(cb)
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
    key = hex(key)

    if (this.islands[key]) return this.islands[key]

    const storagePath = p.join(this.storagePath, 'island', key)
    const island = new Island(storagePath, key, opts)

    this.islands[key] = island
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

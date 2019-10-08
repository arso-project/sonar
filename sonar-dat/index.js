const leveldb = require('level')
const hypercontent = require('hyper-content-db')
const mkdirp = require('mkdirp')
const p = require('path')
// const corestore = require('corestore')
// const sublevel = require('subleveldown')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')

const sonarView = require('./lib/view-sonar')
const ConfigHandler = require('./lib/config')
const Network = require('./lib/network')

class IslandManager {
  constructor (basePath) {
    this.basePath = basePath
    this.network = new Network()

    const configPath = p.join(basePath, 'config.json')
    this.config = new ConfigHandler(configPath)

    this.islands = {}
    this.ready = thunky(this._ready.bind(this))
  }

  _ready (cb) {
    this.config.load((err, config) => {
      if (err) return cb(err)
      if (!config.islands) return cb()
      for (const info of config.islands) {
        const island = this.open(info.key)
        this.network.add(island)
      }
      cb()
    })
  }

  create (name, cb) {
    const keyPair = crypto.keyPair()
    const key = keyPair.publicKey
    const island = this.open(key, { keyPair, name })
    island.ready(err => {
      if (err) return cb(err)
      this._saveIsland({ key, name }, err => cb(err, island))
    })
  }

  openByName (name, cb) {
    this._islandByName(name, (err, info) => {
      if (err) return cb(err)
      let island
      if (info) {
        island = this.open(info.key)
        island.ready(err => cb(err, island))
      } else {
        this.create(name, cb)
      }
    })
  }

  _saveIsland (opts, cb) {
    let { key, name } = opts
    key = hex(key)
    this.config.load((err, config) => {
      if (err) return cb(err)
      config.islands = config.islands || {}
      config.islands[key] = { name }
      this.config.save(config, cb)
    })
  }

  _islandByName (name, cb) {
    this.config.load((err, config) => {
      if (err) return cb(err)
      if (!Array.isArray(config.islands)) return cb()
      const result = config.islands.filter(i => i.name === name)
      if (!result.length) return cb()
      return cb(null, result[0])
    })
  }

  open (key, opts) {
    if (typeof opts === 'function') return this.open(key, {}, opts)
    key = hex(key)

    if (this.islands[key]) return this.islands[key]

    const basePath = p.join(this.basePath, key)

    const island = openIsland(basePath, key)
    this.islands[key] = island
    return island
  }

  share (key) {
    if (!this.islands[key]) return
    this.network.add(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = true
      return config
    })
  }

  unshare (key) {
    if (!this.islands[key]) return
    this.network.remove(this.islands[key])
    this.config.update(config => {
      config.islands[key].share = false
      return config
    })
  }
}

function openIsland (basePath, key, opts = {}) {
  const paths = {
    level: p.join(basePath, 'level'),
    corestore: p.join(basePath, 'corestore'),
    sonar: p.join(basePath, 'sonar')
  }

  Object.values(paths).forEach(p => mkdirp.sync(p))

  const level = opts.level || leveldb(paths.level)

  const island = hypercontent(paths.corestore, key, {
    level,
    sparse: opts.sparse,
    corestore: opts.corestore
  })

  island.useRecordView('search', sonarView, { storage: paths.sonar })

  return island
}

module.exports = {
  openIsland,
  IslandManager
}

function hex (key) {
  return Buffer.isBuffer(key) ? key.toString('hex') : key
}

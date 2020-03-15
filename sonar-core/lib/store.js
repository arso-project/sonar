const p = require('path')
const os = require('os')
const crypto = require('hypercore-crypto')
const sub = require('subleveldown')
const mkdirp = require('mkdirp')
const thunky = require('thunky')
const leveldb = require('level')
const debug = require('debug')('sonar-core')
const Corestore = require('corestore')
const Catalog = require('@arso-project/sonar-tantivy')

const Config = require('./config')
const Network = require('./network')
const Group = require('./group')

const ISLAND_NAME_REGEX = /^[a-zA-Z0-9-_]{3,32}$/

module.exports = class GroupStore {
  constructor (storage, opts = {}) {
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
    this.level = leveldb(this.paths.level)

    debug('storage location: ' + this.paths.base)

    this.groups = {}
    this.opened = false
    this.ready = thunky(this._ready.bind(this))
    this.ready()
  }

  _ready (cb) {
    this.corestore.ready((err) => {
      if (err) return cb(err)
      this.config.load((err, config) => {
        if (err) return cb(err)
        debug('config loaded', this.config.path)
        if (config.groups) {
          for (const info of Object.values(config.groups)) {
            if (info.share) {
              const group = this._open(info.key, info)
              this.network.add(group)
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
        const groups = {}
        if (config.groups) {
          Object.values(config.groups).forEach(group => {
            const { key } = group
            if (this.groups[key]) {
              group.localKey = this.groups[key].db.localKey.toString('hex')
              group.localDrive = this.groups[key].fs.localwriter.key.toString('hex')
            }
            groups[group.key] = group
          })
        }
        cb(null, {
          storage: this.storagePath,
          groups,
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
    if (!name || !name.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid group name'))
    if (!key && !alias) alias = name
    if (!alias) return cb(new Error('alias is required'))
    if (!alias.match(ISLAND_NAME_REGEX)) return cb(new Error('invalid alias'))

    // TODO: Validate key.
    if (key) key = Buffer.from(key, 'hex')
    this._groupByName(name, (err, info) => {
      if (err) return cb(err)
      if (info) return cb(new Error('group exists'))
      this._create(name, { key, alias }, cb)
    })
  }

  _create (name, { key, alias }, cb = noop) {
    const group = this._open(key || null, { name, alias })
    group.ready(err => {
      if (err) return cb(err)
      const info = {
        key: hex(group.key),
        name,
        alias,
        // TODO: Add opt to not share group when creating
        share: true
      }
      this._saveGroup(info, err => cb(err, group))
      if (info.share) this.share(group.key)
    })
  }

  get (keyOrName, opts, cb) {
    if (!cb && typeof opts === 'function') return this.get(keyOrName, {}, opts)

    if (isKey(keyOrName)) {
      const key = hex(keyOrName)
      this._groupByKey(key, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`group ${keyOrName} does not exist.`))
        const group = this._open(info.key, info)
        group.ready(() => cb(null, group))
      })
    } else {
      this._groupByName(keyOrName, (err, info) => {
        if (err) return cb(err)
        if (!info) return cb(new Error(`group ${keyOrName} does not exist.`))
        const group = this._open(info.key, info)
        group.ready(() => cb(null, group))
      })
    }
  }

  list (cb) {
    this.config.load((err, config) => {
      err ? cb(err) : cb(null, config.groups)
    })
  }

  share (key) {
    key = hex(key)
    if (!this.groups[key]) return
    this.network.add(this.groups[key])
    this.config.update(config => {
      config.groups[key].share = true
      return config
    })
  }

  unshare (key) {
    key = hex(key)
    if (!this.groups[key]) return
    this.network.remove(this.groups[key])
    this.config.update(config => {
      config.groups[key].share = false
      return config
    })
  }

  updateGroup (key, config) {
    let newConfig = {}
    if (config.share) {
      newConfig = this.share(key)
    } else {
      newConfig = this.unshare(key)
    }
    return newConfig
  }

  close (cb) {
    const self = this

    let pending = Object.values(this.groups).length + 1
    for (const group of Object.values(this.groups)) {
      group.close(finish)
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

  _saveGroup (info, cb) {
    let { key, name } = info
    key = hex(key)
    this.config.update(config => {
      config.groups = config.groups || {}
      config.groups[key] = { name, key }
      return config
    }, cb)
  }

  _groupByName (name, cb) {
    this.config.load((err, config) => {
      if (err || !config.groups) return cb(err)
      const result = Object.values(config.groups).find(v => v.name === name)
      return cb(null, result)
    })
  }

  _groupByKey (key, cb) {
    this.config.load((err, config) => {
      if (err || !config.groups) return cb(err)
      const result = config.groups[key]
      cb(null, result)
    })
  }

  _open (key, opts) {
    if (typeof opts === 'function') return this._open(key, {}, opts)
    let create = false
    // No key means create a new group. We need the key for the storage path,
    // so first create a new writable feed.
    if (!key) {
      const feed = this.corestore.get()
      key = feed.key
      create = true
    }

    key = hex(key)
    if (this.groups[key]) return this.groups[key]

    // const storagePath = p.join(this.storagePath, 'group', key)
    const namespacedCorestore = this.corestore.namespace(key)
    const groupOpts = {
      ...opts,
      corestore: namespacedCorestore,
      indexCatalog: this.indexCatalog,
      level: sub(this.level, key)
    }
    const group = new Group(key, groupOpts)

    this.groups[key] = group
    // else group.ready(() => (this.groups[hex(group.key)] = group))

    if (create) {
      group.ready(() => {
        group.init(() => {
          // TODO: do anything?
          debug('init group key %s name %s alias %s', group.key.toString('hex'), opts.name, opts.alias)
        })
      })
    }
    return group
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

const pretty = require('pretty-hash')
const { Readable } = require('streamx')
const datEncoding = require('dat-encoding')
const p = require('path')
const sub = require('subleveldown')
const debug = require('debug')('sonar-core:collection')
const hcrypto = require('hypercore-crypto')
const Nanoresource = require('nanoresource/emitter')

const Database = require('./db')
const Fs = require('./fs')
const { loadTypesFromDir, once } = require('./util')

const searchView = require('../views/search')

function getDefaultTypes (cb) {
  const typeSpecs = loadTypesFromDir(p.join(__dirname, '../types'))
  cb(null, typeSpecs)
}

module.exports = class Collection extends Nanoresource {
  constructor (key, opts) {
    super()
    const self = this

    this.opts = opts

    key = datEncoding.decode(key)

    debug('collection open %s (name %s, alias %s)', pretty(key), opts.name, opts.alias)

    this.scope = opts.scope
    this.corestore = opts.scope.corestore
    this.name = opts.name

    this._subscriptions = {}
    this._level = {
      db: sub(opts.level, 'd'),
      fs: sub(opts.level, 'f')
    }

    this.key = key
    this.discoveryKey = hcrypto.discoveryKey(this.key)

    this.db = new Database({
      collection: this,
      rootKey: this.key,
      scope: this.scope,
      corestore: this.corestore,
      db: this._level.db,
      validate: false
    })

    this.fs = new Fs({
      corestore: this.corestore,
      db: this._level.fs,
      oninit (localkey, info) {
        self.db.putFeed(localkey, {
          type: 'hyperdrive',
          alias: opts.alias
        }, (err) => {
          if (err) debug('error adding local hyperdrive as source', err)
        })
      },
      resolveAlias (alias, cb) {
        self.query('records', { type: 'sonar/feed' }, (err, records) => {
          if (err) return cb(err)
          const aliases = records
            .map(r => r.value)
            .filter(v => v.type === 'hyperdrive')
            .filter(v => v.alias === alias)

          if (aliases.length > 1) {
            // TODO: Support named aliases (like foo-1, foo-2)
            return cb(new Error('alias is ambigous, use keys'))
          }
          if (!aliases.length) {
            return cb(new Error('alias not found'))
          }

          cb(null, aliases[0].key)
        })
      }
    })

    // Forward some events.
    this.scope.on('remote-update', () => this.emit('remote-update'))
    this.scope.on('feed', feed => this.emit('feed', feed))
    this.scope.indexer.on('update', () => this.emit('update', this.scope.indexer.length))
    this.db.on('schema-update', () => this.emit('schema-update'))

    this.ready = this.open.bind(this)
    this._eventStreams = new Set()
    this._eventCounter = 0
  }

  emit (event, ...args) {
    const id = ++this._eventCounter
    let data
    if (event === 'update') data = { lseq: args[0] }
    if (event === 'feed') data = { key: args[0].key.toString('hex') }
    const eventObject = { type: event, data, id }
    for (const stream of this._eventStreams) {
      stream.push(eventObject)
    }
    super.emit(event, ...args)
  }

  createEventStream () {
    const stream = new Readable()
    this._eventStreams.add(stream)
    stream.on('destroy', () => this._eventStreams.delete(stream))
    return stream
  }

  get writable () {
    if (this._local && this._local.writable) return true
    return false
  }

  get schema () {
    return this.db.schema
  }

  get localKey () {
    return this.db.localKey
  }

  get rootKey () {
    return this.db.rootKey
  }

  get length () {
    return this.db.scope.indexer.length || 0
  }

  _open (cb) {
    cb = once(cb)
    // db.open also calls scope.open.
    this.db.open(err => {
      if (err) return cb(err)
      this._mountViews()
      this.fs.ready(err => {
        if (err) return cb(err)
        debug(
          'opened collection %s (dkey %s, feeds %d)',
          pretty(this.key),
          pretty(this.discoveryKey),
          this.scope.status().feeds.length
        )
        cb()
      })
    })
  }

  _mountViews () {
    if (this.opts.relations) {
      this.db.use('relations', this.opts.relations.createView(this))
    }
    if (this.opts.indexCatalog) {
      this.db.use('search', searchView, {
        collection: this,
        indexCatalog: this.opts.indexCatalog
      })
    }
  }

  init (cb) {
    cb = once(cb)

    // Add default types to collection.
    getDefaultTypes((err, typeSpecs) => {
      if (err) return cb(err)
      let pending = 0
      for (const typeSpec of typeSpecs) {
        ++pending
        this.db.putType(typeSpec, done)
      }
      function done (err) {
        if (err) return cb(err)
        if (--pending === 0) cb()
      }
    })
  }

  replicate (isInitator, opts) {
    return this.corestore.replicate(isInitator, opts)
  }

  put (record, cb) {
    this.db.put(record, cb)
  }

  del (record, cb) {
    this.db.del(record, cb)
  }

  get (req, opts, cb) {
    this.scope.query('records', req, opts, cb)
  }

  batch (batch, cb) {
    this.db.batch(batch, cb)
  }

  loadRecord (key, seq, cb) {
    this.scope.loadRecord(key, seq, cb)
  }

  putType (spec, cb) {
    this.db.putType(spec, cb)
  }

  getType (name) {
    return this.db.getType(name)
  }

  serializeSchema () {
    return this.db.schema.serializeSchema()
  }

  putFeed (key, info, cb) {
    this.db.putFeed(key, info, cb)
  }

  query (name, args, opts, cb) {
    return this.scope.query(name, args, opts, cb)
  }

  createQueryStream (name, args, opts) {
    return this.scope.createQueryStream(name, args, opts)
  }

  drive (key, cb) {
    this.fs.get(key, cb)
  }

  localDrive (cb) {
    cb(null, this.fs.localwriter)
  }

  sync (cb) {
    this.scope.sync(cb)
  }

  _close (cb) {
    for (const stream of this._eventStreams) {
      stream.destroy()
    }
    this.fs.close(() => {
      this.scope.sync(() => {
        this.scope.close(() => {
          cb()
        })
      })
    })
  }

  // Return some info on the collection synchronously.
  status (cb) {
    if (!this.opened) return cb(null, { opened: false, name: this.name })
    const localDrive = this.fs.localwriter
    if (localDrive) var localDriveKey = datEncoding.encode(localDrive.key)

    const status = {
      ...this.scope.status(),
      name: this.name,
      opened: true,
      key: this.key.toString('hex'),
      discoveryKey: this.discoveryKey.toString('hex'),
      localKey: datEncoding.encode(this.db.localKey),
      rootKey: datEncoding.encode(this.db.rootKey),
      dataKey: datEncoding.encode(this.db.dataKey),
      localDrive: localDriveKey
    }

    if (cb) {
      let pending = 1
      this.fs.status((err, fsStats) => {
        if (err) status.fs = { error: err.message }
        else status.fs = fsStats
        if (--pending === 0) cb(null, status)
      })
    }

    return status
  }

  createSubscription (name, opts = {}) {
    const subscription = this.scope.indexer.createSubscription(name, opts)
    this._subscriptions[name] = subscription
    return subscription
  }

  pullSubscription (name, opts, cb) {
    if (!this._subscriptions[name]) {
      this.createSubscription(name, opts)
    }
    this._subscriptions[name].pull(opts, result => {
      cb(null, result)
    })
  }

  pullSubscriptionStream (name, opts) {
    if (opts.live === undefined) opts.live = true
    if (!this._subscriptions[name]) {
      this.createSubscription(name, opts)
    }
    return this._subscriptions[name].createPullStream(opts)
  }

  ackSubscription (name, cursor, cb) {
    if (!this._subscriptions[name]) return cb(new Error('Subscription does not exist'))
    this._subscriptions[name].setCursor(cursor, cb)
  }

  reindex (views, cb) {
    if (!cb) { cb = views; views = null }
    this.db.reindex(views, cb)
  }
}

const pretty = require('pretty-hash')
const datEncoding = require('dat-encoding')
const sub = require('subleveldown')
const debug = require('debug')('sonar-core:collection')
const hcrypto = require('hypercore-crypto')
const Nanoresource = require('nanoresource/emitter')

const { RESOURCE_SCHEMA } = require('./schemas.js')

const Database = require('@arso-project/sonar-db')
const Fs = require('./fs')

const searchView = require('../views/search')

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

    this.scope.on('remote-update', () => this.emit('remote-update'))
    this.scope.on('feed', feed => this.emit('feed', feed))

    this._subscriptions = {}
    this._level = {
      db: sub(opts.level, 'd'),
      fs: sub(opts.level, 'f')
    }

    this.key = key
    this.discoveryKey = hcrypto.discoveryKey(this.key)

    this.db = new Database({
      scope: this.scope,
      db: this._level.db,
      validate: false
    })

    this.fs = new Fs({
      corestore: this.corestore,
      db: this._level.fs,
      oninit (localkey, info) {
        self.db.putSource(localkey, {
          type: 'hyperdrive',
          alias: opts.alias
        }, (err) => {
          if (err) debug('error adding local hyperdrive as source', err)
        })
      },
      resolveAlias (alias, cb) {
        self.query('records', { type: 'core/source' }, (err, records) => {
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

    this.ready = this.open.bind(this)
  }

  get writable () {
    if (this._local && this._local.writable) return true
    return false
  }

  get schema () {
    return this.db.schema
  }

  _open (cb) {
    const self = this
    cb = once(cb)
    // db.open also calls scope.open.
    this.db.open(err => {
      if (err) return cb(err)
      this._mountViews()

      // If the scope is opened for the first time, it is empty. Add our initial feeds.
      if (!this.scope.list().length) {
        // Add a root feed with the collection key.
        this._root = this.scope.addFeed({ key: this.key, name: 'root' })
        this._root.ready((err) => {
          if (err) return cb(err)
          onfeedsinit()
        })
      // If the scope is reopened, alias our root feed.
      } else {
        this._root = this.scope.feed('root')
      }
      this._root.ready(err => {
        if (err) return cb(err)
        // root is writable: it is also our local feed.
        if (this._root.writable) {
          this._local = this.scope.addFeed({ key: this._root.key, name: 'local' })
          // root is not writable: create a local feed and add it to the scope.
        } else {
          this._local = this.scope.addFeed({ name: 'local' })
        }
        onfeedsinit()
      })
    })

    function onfeedsinit () {
      self.fs.ready(err => {
        if (err) return cb(err)
        debug(
          'opened collection %s (dkey %s, feeds %d)',
          pretty(self.key),
          pretty(self.discoveryKey),
          self.scope.status().feeds.length
        )
        cb()
      })
    }
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
    this.db.putSchema(RESOURCE_SCHEMA.name, RESOURCE_SCHEMA, cb)
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
    this.scope.batch(batch, cb)
  }

  loadRecord (key, seq, cb) {
    this.scope.loadRecord(key, seq, cb)
  }

  putSchema (name, schema, cb) {
    this.db.putSchema(name, schema, cb)
  }

  getSchemas (cb) {
    const schemas = this.db.getSchemas()
    if (cb) cb(null, schemas)
    else return schemas
  }

  getSchema (name, cb) {
    const schema = this.db.getSchema(name)
    if (cb) cb(schema ? null : new Error('Schema not found'), schema)
    else return schema
  }

  putSource (key, info, cb) {
    this.db.putSource(key, info, cb)
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
    const localKey = datEncoding.encode(this._local.key)
    const localDrive = this.fs.localwriter
    if (localDrive) var localDriveKey = datEncoding.encode(localDrive.key)

    const status = {
      ...this.scope.status(),
      name: this.name,
      opened: true,
      key: this.key.toString('hex'),
      discoveryKey: this.discoveryKey.toString('hex'),
      localKey,
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
}

function once (fn) {
  let called = false
  return (...args) => {
    if (!called) fn(...args)
    called = true
  }
}

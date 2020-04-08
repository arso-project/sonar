const thunky = require('thunky')
const pretty = require('pretty-hash')
const sub = require('subleveldown')
const debug = require('debug')('sonar:db')
const { PassThrough } = require('stream')

const { RESOURCE_SCHEMA } = require('./schemas.js')

const Database = require('kappa-record-db')
const Fs = require('./fs')

const sonarView = require('../views/search')
const historyView = require('../views/history')

module.exports = class Island {
  constructor (key, opts) {
    const self = this
    const { level, corestore, indexCatalog } = opts

    debug('open island name %s alias %s key %s', opts.name, opts.alias, pretty(key))

    this.corestore = corestore
    this.indexCatalog = indexCatalog
    this._subscriptions = {}
    this._level = {
      db: sub(level, 'd'),
      fs: sub(level, 'f')
    }

    this.db = new Database({
      key,
      corestore: this.corestore,
      db: this._level.db,
      validate: false,
      name: opts.name,
      alias: opts.alias
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
        self.query('records', { schema: 'core/source' }, (err, records) => {
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

    if (opts.name) this.name = opts.name

    this.ready = thunky(this._ready.bind(this))
  }

  _ready (cb) {
    this.db.ready(() => {
      this.key = this.db.key
      this.discoveryKey = this.db.discoveryKey

      this.db.use('search', sonarView, {
        indexCatalog: this.indexCatalog
      })
      this.db.use('history', historyView)

      this.fs.ready(() => {
        debug('ready', this.db)
        cb()
      })
    })
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

  get (req, opts, cb) {
    this.db.get(req, opts, cb)
  }

  batch (batch, cb) {
    this.db.batch(batch, cb)
  }

  loadRecord (key, seq, cb) {
    this.db.loadRecord(key, seq, cb)
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
    return this.db.query(name, args, opts, cb)
  }

  drive (key, cb) {
    this.fs.get(key, cb)
  }

  localDrive (cb) {
    cb(null, this.fs.localwriter)
  }

  close (cb) {
    let pending = 2
    this.db.close(done)
    this.fs.close(done)
    function done () {
      if (--pending === 0) cb()
    }
  }

  getState (cb) {
    const indexer = this.db.indexer
    const subscriptions = indexer._subscriptions
    const statuses = {}
    // console.log('subs', subscriptions)
    let pending = Object.keys(subscriptions).length
    for (const [name, sub] of Object.entries(subscriptions)) {
      sub.getState((err, status) => {
        if (err) return cb(err)
        statuses[name] = status
        if (--pending === 0) cb(null, statuses)
      })
    }
  }

  createSubscription (name, opts = {}) {
    const subscription = this.db.indexer.createSubscription(name, opts)
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

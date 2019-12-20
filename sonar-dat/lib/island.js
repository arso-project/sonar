const leveldb = require('level')
const mkdirp = require('mkdirp')
const p = require('path')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')
const sub = require('subleveldown')

const Corestore = require('corestore')
const Database = require('kappa-record-db')
const Fs = require('./fs')

const sonarView = require('./search/view-sonar')

module.exports = class Island {
  constructor (storage, key, opts) {
    const paths = {
      level: p.join(storage, 'level'),
      corestore: p.join(storage, 'corestore'),
      tantivy: p.join(storage, 'tantivy')
    }

    // TODO: Remove sync op?
    Object.values(paths).forEach(p => mkdirp.sync(p))

    const level = leveldb(paths.level)

    this._level = {
      db: sub(level, 'd'),
      fs: sub(level, 'f')
    }

    this.corestore = new Corestore(paths.corestore)
    this.db = new Database({
      key,
      corestore: this.corestore,
      db: this._level.db,
      validate: false
    })

    this.fs = new Fs({
      corestore: this.corestore,
      db: this._level.fs
    })

    this.db.useRecordView('search', sonarView, { storage: paths.tantivy })

    if (opts.name) this.localname = opts.name

    this.key = key
    this.discoveryKey = crypto.discoveryKey(this.key)

    this.ready = thunky(this._ready.bind(this))
  }

  _ready (cb) {
    this.db.ready(() => {
      this.fs.ready(() => {
        cb()
      })
    })
  }

  put (record, cb) {
    this.db.put(record, cb)
  }

  get (req, cb) {
    this.db.get(req, cb)
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

  putSource (key, cb) {
    this.db.putSourc(key, cb)
  }

  query (name, args, cb) {
    if (!this.db.view[name] || !this.db.view[name].query) {
      return cb(new Error('Invalid view: ' + name))
    }
    return this.db.view[name].query(args, cb)
  }

  localDrive (cb) {
    cb(null, this.fs.localwriter)
  }

  close (cb) {
    this.db.close(cb)
  }

  createSubscription (name, filter) {
    this._subscriptions = this._subscriptions || {}
    if (this._subscriptions[name]) return
    this._subscriptions[name] = { filter, state: -1 }
  }

  readSubscription (name, cb) {
    const self = this
    const { filter = {}, state } = this._subscriptions[name]
    const count = 50
    let start = state + 1
    this.db.indexer.pull(start, start + count, (result) => {
      let results = []
      if (!result) return finish()
      let { messages, head, seq } = result
      let pending = messages.length + 1
      messages.forEach(msg => this.db.loadRecord(msg.key, msg.seq, done))
      done()
      function done (err, msg) {
        if (err) return finish(err)
        if (msg) results.push(msg)
        if (--pending === 0) finish(null, { results, seq })
      }
      function finish (err, data) {
        if (err || !data) return cb(err, [])
        let { results, seq } = data
        results = results.filter(msg => {
          if (filter.schema && filter.schema !== msg.schema) return false
          return true
        })
        if (seq) self._subscriptions[name].state = seq
        cb(null, results)
      }
    })
  }
}

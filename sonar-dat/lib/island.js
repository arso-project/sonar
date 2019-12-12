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

  getSchemas () {
    return this.db.getSchemas()
  }

  getSchema () {
    return this.db.getSchema()
  }

  putSource (key, cb) {
    this.db.putSourc(key, cb)
  }

  localDrive (cb) {
    cb(null, this.fs.localwriter)
  }

  close (cb) {
    if (cb) cb()
  }
}

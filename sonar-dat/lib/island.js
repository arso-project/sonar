const leveldb = require('level')
const mkdirp = require('mkdirp')
const p = require('path')
const crypto = require('hypercore-crypto')
const thunky = require('thunky')
const pretty = require('pretty-hash')
const sub = require('subleveldown')
const debug = require('debug')('sonar:db')

const { RESOURCE_SCHEMA } = require('./schemas.js')

const Database = require('kappa-record-db')
const Fs = require('./fs')

const sonarView = require('./search/view-sonar')

module.exports = class Island {
  constructor (storage, key, opts) {
    const self = this
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

    this.corestore = opts.corestore
    debug('open island name %s alias %s key %s', opts.name, opts.alias, pretty(key))

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

    this.db.useRecordView('search', sonarView, { storage: paths.tantivy })

    if (opts.name) this.name = opts.name

    this.ready = thunky(this._ready.bind(this))
  }

  _ready (cb) {
    this.db.ready(() => {
      this.key = this.db.key
      this.discoveryKey = this.db.discoveryKey
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
    this.db.close(cb)
  }
}

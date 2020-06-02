const debug = require('debug')('db')
const pretty = require('pretty-hash')
const thunky = require('thunky')
const sub = require('subleveldown')

const { uuid, sink, noop } = require('./lib/util')
const createKvView = require('./views/kv')
const createRecordsView = require('./views/records')
const createIndexView = require('./views/indexes')
const createHistoryView = require('./views/history')
const Record = require('./lib/record')
const Schema = require('./lib/schema')

const FEED_TYPE = 'sonar.db'
const FEED_NAME = 'local.db'
const SCHEMA_SOURCE = 'core/source'

module.exports = class Database {
  constructor (opts) {
    this.opts = opts
    this.scope = opts.scope
    this.schemas = new Schema()
    this.scope.registerFeedType(FEED_TYPE, {
      onopen: this._onopen.bind(this),
      onload: this._onload.bind(this),
      onappend: this._onappend.bind(this)
    })
    this.scope.use('kv', createKvView(
      sub(opts.db, 'kv')
    ))
    this.scope.use('records', createRecordsView(
      sub(opts.db, 'records'),
      this,
      {
        schemas: this.schemas
      }
    ))
    this.scope.use('index', createIndexView(
      sub(opts.db, 'index'),
      this,
      {
        schemas: this.schemas
      }
    ))
    this.scope.use('history', createHistoryView(
      sub(opts.db, 'history'),
      this
    ))

    this.api = {
      kv: this.scope.api.kv
    }
  }

  // TODO: change args to standard
  use (name, createView, opts) {
    const db = sub(this.opts.db, 'view.' + name)
    const view = createView(db, this, opts)
    this.scope.use(name, view, opts)
  }

  _onopen (cb) {
    console.log('db open', this.scope)
    initSchemas(this.scope, this.schemas, () => {
      initSources(this.scope, cb)
    })
  }

  _onload (message, opts, cb) {
    const { key, seq, lseq, value, feedType } = message
    const record = Record.decode(value, { key, seq, lseq, feedType })
    cb(null, record)
  }

  _onappend (record, opts, cb) {
    if (!record.schema) return cb(new Error('schema is required'))
    if (record.op === undefined) record.op = Record.PUT
    if (record.op === 'put') record.op = Record.PUT
    if (record.op === 'del') record.op = Record.DEL
    if (!record.id) record.id = uuid()

    record.schema = this.schemas.resolveName(record.schema)

    if (record.op === Record.PUT) {
      let validate = false
      if (this.opts.validate) validate = true
      if (typeof opts.validate !== 'undefined') validate = !!opts.validate

      if (validate) {
        if (!this.schemas.validate(record)) return cb(this.schemas.error)
      }
    }

    record.timestamp = Date.now()

    this.scope.view.kv.getLinks(record, (err, links) => {
      if (err && err.status !== 404) return cb(err)
      record.links = links || []
      const buf = Record.encode(record)
      cb(null, buf, record.id)
    })
  }

  loadRecord (req, cb) {
    this.scope.loadRecord(req, cb)
  }

  put (record, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    record.op = Record.PUT
    opts.feedType = FEED_TYPE
    this.scope.append(record, opts, cb)
  }

  del ({ id, schema }, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    opts.feedType = FEED_TYPE
    const record = {
      id,
      schema,
      op: Record.DEL
    }
    this.scope.append(record, opts, cb)
  }

  putSchema (name, schema, cb) {
    this.scope.ready(() => {
      const value = this.schemas.parseSchema(name, schema)
      if (!value) return cb(this.schemas.error)
      const record = {
        schema: 'core/schema',
        value
      }
      this.schemas.put(value)
      this.put(record, cb)
    })
  }

  getSchema (name) {
    return this.schemas.get(name)
  }

  getSchemas () {
    return this.schemas.list()
  }

  putSource (key, info = {}, cb) {
    // opts should/can include: { alias }
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    const record = {
      schema: SCHEMA_SOURCE,
      id: key,
      value: {
        type: FEED_TYPE,
        key,
        ...info
      }
    }
    this.put(record, cb)
  }
}

function initSources (scope, cb) {
  const qs = scope.createQueryStream('records', { schema: 'core/source' }, { live: true })
  qs.once('sync', cb)
  qs.pipe(sink((record, next) => {
    const { alias, key, type, ...info } = record.value
    if (type !== FEED_TYPE) return next()
    debug('[%s] source:add key %s alias %s type %s', scope._name, pretty(key), alias, type)
    const feedOpts = { alias, key, type, info }
    scope.addFeed(feedOpts)
    next()
  }))
}

function initSchemas (scope, schemas, cb) {
  schemas.setKey(scope.key)
  const qs = scope.createQueryStream('records', { schema: 'core/schema' }, { live: true })
  qs.once('sync', cb)
  qs.pipe(sink((record, next) => {
    schemas.put(record.value)
    next()
  }))
}

const debug = require('debug')('db')
const pretty = require('pretty-hash')
const thunky = require('thunky')
const sub = require('subleveldown')
const Nanoresource = require('nanoresource')

const { uuid, sink, noop } = require('./lib/util')
const createKvView = require('./views/kv')
const createRecordsView = require('./views/records')
const createIndexView = require('./views/indexes')
const createHistoryView = require('./views/history')
const Schema = require('@arso-project/sonar-common/schema')
const Record = require('./lib/record')

const FEED_TYPE = 'sonar.db'
const FEED_NAME = 'local.db'
const SCHEMA_SOURCE = 'core/source'

module.exports = class Database extends Nanoresource {
  constructor (opts) {
    super()
    this.opts = opts
    this.scope = opts.scope
    this.schema = new Schema()
    this.scope.registerFeedType(FEED_TYPE, {
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
        schema: this.schema
      }
    ))
    this.scope.use('index', createIndexView(
      sub(opts.db, 'index'),
      this,
      {
        schema: this.schema
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

  open (cb) {
    this.scope.open(err => {
      if (err) return cb(err)
      initSchema(this.scope, this.schema, err => {
        if (err) return cb(err)
        initSources(this.scope, cb)
      })
    })
  }

  _onload (message, opts, cb) {
    const { key, seq, lseq, value, feedType } = message
    const decodedRecord = Record.decode(value, { key, seq, lseq, feedType })
    // decodedRecord.type = decodedRecord.schema
    // console.log('onload out', decodedRecord)
    try {
      const record = this.schema.Record(decodedRecord)
      cb(null, record)
    } catch (err) {
      cb(err)
      // TODO: Error here?
      // this.schema.addType({
      //   address: decodedRecord.type
      // })
      // const record = this.schema.Record(decodedRecord)
      // cb(null, record)
      // console.error(err)
      // console.error(message)
      // console.error(this.schema)
    }
  }

  _onappend (record, opts, cb) {
    if (!record.type) return cb(new Error('type is required'))
    if (record.op === undefined) record.op = Record.PUT
    if (record.op === 'put') record.op = Record.PUT
    if (record.op === 'del') record.op = Record.DEL
    if (!record.id) record.id = uuid()

    record.type = this.schema.resolveTypeAddress(record.schema || record.type)

    if (record.op === Record.PUT) {
      let validate = false
      if (this.opts.validate) validate = true
      if (typeof opts.validate !== 'undefined') validate = !!opts.validate

      if (validate) {
        // TODO: add validate
        // if (!this.schemas.validate(record)) return cb(this.schemas.error)
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

  putSchema (name, spec, cb) {
    this.scope.ready(() => {
      spec.name = name
      try {
        const type = this.schema.addType(spec)
        const record = {
          type: 'core/schema',
          id: type.address,
          value: type.toJSONSchema()
        }
        this.put(record, cb)
      } catch (err) {
        cb(err)
      }
    })
  }

  // TODO: Rename to getType or remove.
  // TODO: Rethink if schema.getType() should throw or return null.
  getSchema (name) {
    try {
      return this.schema.getType(name)
    } catch (err) {
      return null
    }
  }

  // TODO: Rename to encodeSchema
  getSchemas (opts = {}) {
    const types = this.schema.getTypes()
    const spec = types.reduce((spec, type) => {
      spec[type.address] = type
      return spec
    }, {})
    return spec
  }

  putSource (key, info = {}, cb) {
    // opts should/can include: { alias }
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    const record = {
      type: SCHEMA_SOURCE,
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
  const qs = scope.createQueryStream('records', { type: 'core/source' }, { live: true })
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

function initSchema (scope, schemas, cb) {
  schemas.setDefaultNamespace(scope.key)
  const qs = scope.createQueryStream('records', { type: 'core/schema' }, { live: true })
  qs.once('sync', cb)
  qs.on('error', err => scope.emit('error', err))
  qs.pipe(sink((record, next) => {
    try {
      schemas.addTypeFromJsonSchema(record.value)
    } catch (err) {
      console.error('Error: Trying to add invalid type: ' + record.id)
      console.error(err)
      console.error(record)
    }
    next()
  }))
}

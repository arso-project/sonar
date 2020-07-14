const debug = require('debug')('db')
const pretty = require('pretty-hash')
const thunky = require('thunky')
const sub = require('subleveldown')
const Nanoresource = require('nanoresource/emitter')
const { Scope } = require('kappa-scopes')

const { uuid, sink, noop } = require('./lib/util')
const createKvView = require('./views/kv')
const createRecordsView = require('./views/records')
const createIndexView = require('./views/indexes')
const createHistoryView = require('./views/history')
const Schema = require('@arso-project/sonar-common/schema')
const Record = require('./lib/record')

const FEED_TYPE = {
  DATA: 'sonar-data',
  ROOT: 'sonar-root'
}
const FEED_NAME = {
  ...FEED_TYPE,
  LOCALROOT: 'sonar-localroot'
}

const TYPE = {
  FEED: 'sonar/feed',
  TYPE: 'sonar/type'
}

const TYPE_SPECS = require('./lib/schemas')

module.exports = class Database extends Nanoresource {
  constructor (opts) {
    super()
    const self = this
    this.opts = opts
    this.scope = opts.scope
    this.schema = new Schema()

    const schemaDb = sub(opts.db, 'schema')
    this.schema.persist = cb => {
      const spec = this.schema.toJSON()
      schemaDb.put('spec', JSON.stringify(spec), cb)
    }
    this.schema.load = cb => {
      this.schema.setDefaultNamespace(this.opts.rootKey.toString('hex'))
      schemaDb.get('spec', (err, str) => {
        if (err && !err.notFound) return cb(err)
        if (!err) {
          const spec = JSON.parse(str)
          this.schema.fromJSON(spec)
        }
        cb()
      })
    }

    // Add predefined types to schema.
    for (const spec of Object.values(TYPE_SPECS)) {
      this.schema.addType(spec)
    }

    this.scope.registerFeedType(FEED_TYPE.DATA, {
      onload: this._onload.bind(this),
      onappend: this._onappend.bind(this)
    })
    this.scope.registerFeedType(FEED_TYPE.ROOT, {
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

    this.scope.use('root', {
      map (records, next) {
        for (const record of records) {
          if (record.hasType(TYPE.FEED)) {
            // console.log(self.name, 'ADD FEED', record.value)
            const { alias, key, type, ...info } = record.value
            const feedOpts = { alias, key, type, info }
            self.scope.addFeed(feedOpts)
          }
          if (record.hasType(TYPE.TYPE)) {
            // console.log(self.name, 'ADD TYPE', record.id)
            try {
              self.schema.addTypeFromJsonSchema(record.value)
            } catch (err) {
              // TODO: Think about error handling here. This would likely crash the server which is too much.
              const error = new Error('Error: Trying to add invalid type: ' + record.id, err.message)
              self.emit('error', error)
            }
          }
        }
        self.schema.persist(next)
      }
    }, {
      scopeFeed (info) {
        return info.type === FEED_TYPE.ROOT
      }
    })

    this._feeds = new Set()
    this._rootFeeds = new Set()

    this.api = {
      kv: this.scope.api.kv
    }
  }

  get name () {
    return this.opts.collection.name
  }

  // TODO: change args to standard
  use (name, createView, opts = {}) {
    const db = sub(this.opts.db, 'view.' + name)
    const view = createView(db, this, opts)
    this.scope.use(name, view, opts)
  }

  get rootKey () {
    return this._root && this._root.key
  }

  get localKey () {
    return this._local && this._local.key
  }

  open (cb) {
    this.scope.open(err => {
      if (err) return cb(err)
      this.schema.load(err => {
        if (err) return cb(err)
        this._initFeeds(err => {
          if (err) return cb(err)
          initSources(this.scope, cb)
        })
      })
    })
  }

  _initFeeds (cb) {
    const self = this
    this.scope.addFeed({
      name: FEED_NAME.ROOT,
      type: FEED_TYPE.ROOT,
      key: this.opts.rootKey
    }, (err, feed) => {
      if (err) return cb(err)
      this._root = feed
      if (feed.writable) {
        this._local = feed
        createLocalDataFeed()
      } else {
        this.scope.addFeed({
          name: FEED_NAME.LOCALROOT,
          type: FEED_TYPE.ROOT
        }, (err, feed) => {
          if (err) return cb(err)
          this._local = feed
          createLocalDataFeed()
        })
      }
    })

    function createLocalDataFeed () {
      self.scope.addFeed({
        name: FEED_NAME.DATA,
        type: FEED_TYPE.DATA
      }, (err, feed) => {
        if (err) return cb(err)
        self._data = feed
        if (self._local.length < 2) self._initRoot(cb)
        else cb()
      })
    }
  }

  _initRoot (cb) {
    // If on a clone then
    // this._local.key !== this._root.key:
    // then do: this.putFeed(this._root.key, { type: FEED_TYPE.ROOT, parent: this._root.key.toString('hex') })

    this.putDataFeed(this._data.key, { type: FEED_TYPE.DATA, parent: this._root.key.toString('hex') }, err => {
      cb(err)
    })
  }

  _onload (message, opts, cb, retry = false) {
    const { key, seq, lseq, value, feedType } = message
    const decodedRecord = Record.decode(value, { key, seq, lseq, feedType })
    // decodedRecord.type = decodedRecord.schema
    // console.log('onload out', decodedRecord)
    try {
      const record = this.schema.Record(decodedRecord)
      cb(null, record)
    } catch (err) {
      console.error('onload error', err)
      if (retry) return cb(err)
      // TODO: Make sure this doesn't loop infinitely.
      this.scope.ready('root', err => {
        console.error('root scope ready', err)
        this._onload(message, opts, cb, true)
      })
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
    if (!record.id) record.id = uuid()
    try {
      record = this.schema.Record(record)
    } catch (err) {
      return cb(err)
    }

    this.scope.view.kv.getLinks(record, (err, links) => {
      if (err && err.status !== 404) return cb(err)

      // TODO: All the encoding should happen at the same place. Likely add a RecordEncoder.
      // Encodings would be JSON (as in schema/Record.toJSON) and protobuf (as in db/Record.encode)
      record = record.toJSON()
      record.links = links || []
      record.op = record.deleted ? Record.DEL : Record.PUT
      if (record.deleted) {
        record.value = undefined
      }
      record.timestamp = Date.now()

      const buf = Record.encode(record)
      cb(null, buf, record.id)
    })

    // if (!record.type) return cb(new Error('type is required'))
    // if (record.op === undefined) record.op = Record.PUT
    // if (record.op === 'put') record.op = Record.PUT
    // if (record.op === 'del') record.op = Record.DEL
    // record.type = this.schema.resolveTypeAddress(record.schema || record.type)

    // if (record.op === Record.PUT) {
    //   let validate = false
    //   if (this.opts.validate) validate = true
    //   if (typeof opts.validate !== 'undefined') validate = !!opts.validate

    //   if (validate) {
    //     // TODO: add validate
    //     // if (!this.schemas.validate(record)) return cb(this.schemas.error)
    //   }
    // }
  }

  append (record, opts, cb) {
    let feed
    if (opts.root) {
      // If this is not a clone, this._root === this._local. If it is a clone, this._local is the "local root".
      feed = this._local
    } else {
      feed = this._data
    }
    this._onappend(record, opts, (err, buf, result) => {
      if (err) return cb(err)
      feed.append(buf, err => {
        if (err) return cb(err)
        cb(null, result)
      })
    })
  }

  loadRecord (req, cb) {
    this.scope.loadRecord(req, cb)
  }

  put (record, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    // if (opts.root) {
    //   opts.feedType = FEED_TYPE.ROOT
    //   opts.name = FEED_NAME.ROOT
    // } else if (!opts.name) {
    //   opts.feedType = FEED_TYPE.DATA
    //   opts.name = FEED_NAME.DATA
    // }
    this.append(record, opts, cb)
  }

  del ({ id, type }, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    const record = { id, type, deleted: true }
    this.put(record, opts, cb)
  }

  // TODO: Remove
  putSchema (name, spec, cb) {
    spec.name = name
    this.putType(spec, cb)
  }

  putType (spec, cb) {
    this.scope.ready(() => {
      try {
        const type = this.schema.addType(spec)
        const record = {
          type: TYPE.TYPE,
          id: type.address,
          value: type.toJSONSchema()
        }
        const opts = { root: true }
        this.put(record, opts, cb)
      } catch (err) {
        cb(err)
      }
    })
  }

  getType (address) {
    this.schema.getType(address)
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

  // TODO: Remove, replace with putFeed
  putSource (key, info = {}, cb) {
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    this.putFeed(key, info, cb)
  }

  putFeed (key, info = {}, cb) {
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    this.putRootFeed(key, info, cb)
  }

  putRootFeed (key, info = {}, cb) {
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    info.type = FEED_TYPE.ROOT
    this._putFeed(key, info, cb)
  }

  putDataFeed (key, info = {}, cb) {
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    info.type = FEED_TYPE.DATA
    this._putFeed(key, info, cb)
  }

  _putFeed (key, info = {}, cb) {
    // opts should/can include: { alias }
    if (typeof info === 'function') {
      cb = info
      info = {}
    }
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    if (!info.type) return cb(new Error('Type is required'))
    const record = {
      type: TYPE.FEED,
      id: key,
      value: {
        ...info,
        key
      }
    }
    const opts = { root: true }
    this.put(record, opts, cb)
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

function initSchema (scope, schema, cb) {
  schema.setDefaultNamespace(scope.key)

  for (const spec of Object.values(SCHEMAS)) {
    schema.addType(spec)
  }

  const qs = scope.createQueryStream('records', { type: 'core/schema' }, { live: true })
  qs.once('sync', cb)
  qs.on('error', err => scope.emit('error', err))
  qs.pipe(sink((record, next) => {
    try {
      schema.addTypeFromJsonSchema(record.value)
    } catch (err) {
      console.error('Error: Trying to add invalid type: ' + record.id)
      console.error(err)
      console.error(record)
    }
    next()
  }))
}

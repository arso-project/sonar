const sub = require('subleveldown')
const Nanoresource = require('nanoresource/emitter')

const { uuid } = require('./lib/util')
const createKvView = require('./views/kv')
const createRecordsView = require('./views/records')
const createIndexView = require('./views/indexes')
const createHistoryView = require('./views/history')
const Schema = require('@arso-project/sonar-common/schema')
const Record = require('./lib/record')
const onDriveLoad = require('./lib/drive')

const FEED_TYPE = {
  DATA: 'sonar-data',
  ROOT: 'sonar-root',
  DRIVE: 'hyperdrive'
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
      this.emit('schema-update')
    }
    this.schema.load = cb => {
      this.schema.setDefaultNamespace(this._root.key.toString('hex'))
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
      onload: this._onload.bind(this)
    })
    this.scope.registerFeedType(FEED_TYPE.ROOT, {
      onload: this._onload.bind(this)
    })
    this.scope.registerFeedType(FEED_TYPE.DRIVE, {
      onload: this._ondriveload.bind(this)
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
        let schemaUpdated
        for (const record of records) {
          if (record.hasType(TYPE.FEED)) {
            // console.log(self.name, 'ADD FEED', record.value)
            const { alias, key, type, ...info } = record.value
            // TODO: Make it configurable which feeds are considered "record feeds".
            if (type === FEED_TYPE.ROOT || type === FEED_TYPE.DATA || type === FEED_TYPE.DRIVE) {
              const feedOpts = { alias, key, type, info }
              self.scope.addFeed(feedOpts)
            }
          }
          if (record.hasType(TYPE.TYPE)) {
            // console.log(self.name, 'ADD TYPE', record.id)
            try {
              self.schema.addTypeFromJsonSchema(record.value)
              schemaUpdated = true
            } catch (err) {
              // TODO: Think about error handling here. This would likely crash the server which is too much.
              const error = new Error('Error: Trying to add invalid type: ' + record.id, err.message)
              console.error(error)
              // self.emit('error', error)
            }
          }
        }
        if (schemaUpdated) self.schema.persist(next)
        else next()
      }
    }, {
      scopeFeed (key, info) {
        return true
        // return info.type === FEED_TYPE.ROOT
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

  get dataKey () {
    return this._data && this._data.key
  }

  open (cb) {
    this.scope.open(err => {
      if (err) return cb(err)
      this._initFeeds(err => {
        if (err) return cb(err)
        this.schema.load(err => {
          if (err) return cb(err)
          cb()
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
    const { key, seq, lseq, value } = message
    const decodedRecord = Record.decode(value, { key, seq, lseq })
    try {
      const record = this.schema.Record(decodedRecord)
      // TODO: Rethink where / how the delete property works.
      cb(null, record)
    } catch (err) {
      if (retry) return cb(err)
      // TODO: Make sure this doesn't loop infinitely.
      this.scope.sync('root', err => {
        if (err) return cb(err)
        this._onload(message, opts, cb, true)
      })
    }
  }

  _ondriveload (message, opts, cb) {
    onDriveLoad(this.schema, message, cb)
  }

  _onappend (record, opts, cb) {
    if (!record.id) record.id = uuid()
    try {
      record = this.schema.Record(record)
    } catch (err) {
      return cb(err)
    }

    // TODO: Validate record value.

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
    this.scope.load(req, cb)
  }

  batch (records, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    cb = once(cb)
    let pending = records.length
    const errors = []
    const results = []
    // TODO: Readd proper batching as a single op.
    // This will need to sort the records into batches per feed, and then do a single append with an array on each feed.
    for (const record of records) {
      this.put(record, opts, done)
    }

    function done (err, res) {
      if (err) errors.push(err)
      else results.push(res)

      if (--pending !== 0) return

      if (errors.length) {
        const error = new Error(`Batch failed with ${errors.length} errors. First error: ${errors[0].message}`)
        error.errors = errors
        cb(error, results)
      }
      return cb(null, results)
    }
  }

  put (record, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    this.append(record, opts, cb)
  }

  del ({ id, type }, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    const record = { id, type, deleted: true }
    this.put(record, opts, cb)
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
    try {
      return this.schema.getType(address)
    } catch (e) {
      return null
    }
  }

  putFeed (key, info = {}, cb) {
    if (typeof info === 'function') { cb = info; info = {} }
    if (!info.type) {
      this.putRootFeed(key, info, cb)
    } else {
      this._putFeed(key, info, cb)
    }
  }

  putRootFeed (key, info = {}, cb) {
    if (typeof info === 'function') { cb = info; info = {} }
    info.type = FEED_TYPE.ROOT
    this._putFeed(key, info, cb)
  }

  putDataFeed (key, info = {}, cb) {
    if (typeof info === 'function') { cb = info; info = {} }
    info.type = FEED_TYPE.DATA
    this._putFeed(key, info, cb)
  }

  _putFeed (key, info = {}, cb) {
    if (typeof info === 'function') { cb = info; info = {} }
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

  reindex (views, cb) {
    if (!cb) { cb = views; views = null }
    this.scope.kappa.reset(views, cb)
  }
}

function once (fn) {
  let called = false
  return (...args) => {
    if (!called) fn(...args)
    called = true
  }
}

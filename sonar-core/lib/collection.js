const hcrypto = require('hypercore-crypto')
const mutexify = require('mutexify/promise')
const datEncoding = require('dat-encoding')
const pretty = require('pretty-hash')
const inspect = require('inspect-custom-symbol')
const pump = require('pump')
const collectStream = require('stream-collector')
const { Transform } = require('streamx')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const Kappa = require('kappa-core')
const Indexer = require('kappa-sparse-indexer')

const { Record, Type, Schema } = require('@arso-project/sonar-common')
const LevelMap = require('./utils/level-map')
const EventStream = require('./utils/eventstream')
const Workspace = require('./workspace')
const RecordEncoder = require('./record-encoder')
const { Header } = require('./messages')
const { uuid, once, deriveId, maybeCallback } = require('./util')
const createKvView = require('../views/kv')
const createRecordsView = require('../views/records')
const createIndexView = require('../views/indexes')
const createHistoryView = require('../views/history')
const CORE_TYPE_SPECS = require('./types.json')

const FEED_TYPE_ROOT = 'sonar.root'
// const FEED_TYPE_DATA = 'sonar.data'

const TYPE_FEED = 'sonar/feed'
const TYPE_TYPE = 'sonar/type'

const DEFAULT_CONFIG = {
  share: true
}

function useDefaultViews (collection) {

}

class Collection extends Nanoresource {
  constructor (keyOrName, opts) {
    super()
    if (Buffer.isBuffer(keyOrName)) keyOrName = keyOrName.toString('hex')
    this._workspace = opts.workspace || new Workspace(opts)
    this._keyOrName = keyOrName
    this._opts = opts

    if (opts.id) this._id = opts.id

    this.log = this._workspace.log.child({
      collection: this
    })

    this.schema = new Schema({
      onchange: (schema) => {
        if (!this._localState) return
        this._localState.set('schema', schema.toJSON())
        this.emit('schema-update', schema)
      }
    })

    this._feeds = new Map()

    // Set in _open()
    this._indexer = null
    this._localState = null
    this._feedInfo = null

    this._kappa = new Kappa()
    this._queryHandlers = new Map()
    this._onerror = (err) => err && this.emit('error', err)
    this._subscriptions = new Map()
    this.lock = opts.lock || mutexify()

    this._eventStream = new EventStream()

    // Push some events into event streams
    // Event streams are an easy way to forward events over RPC or HTTP.
    this._forwardEvent('open')
    this._forwardEvent('update', lseq => ({ lseq }))
    this._forwardEvent('feed', (feed, info) => ({ ...info }))
    this._forwardEvent('schema-update', () => ({}))
  }

  _forwardEvent (event, map) {
    if (!map) map = (data) => data
    this.on(event, (...args) => this._pushEvent(event, map(...args)))
  }

  _pushEvent (event, data) {
    this.log.trace('event: ' + event)
    this._eventStream.write({ event, data })
  }

  // Public API

  get key () {
    return this._rootFeed && this._rootFeed.key
  }

  get discoveryKey () {
    return this._rootFeed && this._rootFeed.discoveryKey
  }

  get view () {
    return this._kappa.view
  }

  get api () {
    return this._kappa.api
  }

  get localKey () {
    return this._localFeed && this._localFeed.key
  }

  get dataKey () {
    return this._dataFeed && this._dataFeed.key
  }

  get rootFeed () {
    return this._rootFeed
  }

  get length () {
    return this._indexer.length
  }

  get id () {
    return this._id
  }

  get name () {
    return this._opts.name || this.id
  }

  ready (cb) {
    cb = maybeCallback(cb)
    if (this.opened) process.nextTick(cb)
    else this.open().then(cb, cb)
    return cb.promise
  }

  registerQuery (name, handler) {
    this._queryHandlers.set(name, handler)
  }

  use (name, view, opts = {}) {
    if (this.closing || this.closed) return
    const self = this
    if (typeof view === 'function') {
      view = {
        map: view
      }
    }

    const sourceOpts = {
      maxBatch: opts.maxBatch
    }

    // if (opts.filterFeed) {
    //   // TODO: Make async?
    //   sourceOpts.filterKey = function (key) {
    //     return opts.filterFeed(key)
    //   }
    // }

    if (opts.batch === false) {
      const mapFn = view.map.bind(view)
      view.map = async function (records) {
        for (const record of records) {
          await mapFn(record)
        }
      }
    }

    opts.transform = function (messages, next) {
      const getOpts = {}
      if (opts.upcast === false) getOpts.upcast = false
      next = once(next)
      let pending = messages.length
      messages.forEach((req, i) => {
        self.getBlock(req, getOpts)
          .then(record => {
            messages[i] = record
            if (--pending === 0) next(messages.filter(m => m))
          })
          .catch(err => {
            // console.error('getBlock error', err)
            if (err) messages[i] = undefined
            if (--pending === 0) next(messages.filter(m => m))
          })
      })
    }

    const flow = this._kappa.use(name, this._indexer.createSource(sourceOpts), view, opts)
    if (flow.view.query) {
      this.registerQuery(name, flow.view.query)
    } else if (view.query) {
      this.registerQuery(name, view.query)
    }

    return flow
  }

  feeds () {
    return Array.from(this._feeds.values())
    // return this._kappa.feeds()
  }

  feed (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    return this._feeds.get(key)
    // return this._kappa.feed(key)
  }

  feedInfo (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    return this._feedInfo.get(key)
  }

  async configure (configuration = {}, save = true) {
    // Apply network configuration.
    if (configuration.share !== false) {
      this._workspace.network.configure(this.discoveryKey, {
        announce: true,
        lookup: true
      })
    } else {
      this._workspace.network.configure(this.discoveryKey, {
        announce: false,
        lookup: false
      })
    }

    if (save) {
      await this._localState.setFlush('config', configuration)
    }
  }

  getConfig () {
    return this._localState.get('config')
  }

  async put (record, opts = {}) {
    const batch = new Batch(this)
    await batch.put(record, opts)
    await batch.flush()
    this.log.debug({ message: 'put', record: batch.entries[0] })
    return batch.entries[0]
  }

  async del (record, opts = {}) {
    const batch = new Batch(this)
    await batch.del(record, opts)
    await batch.flush()
    this.log.debug({ message: 'del', record: batch.entries[0] })
    return batch.entries[0]
  }

  async batch (records, opts = {}) {
    const batch = new Batch(this)
    if (!records) {
      return batch
    }
    for (const record of records) {
      await batch._append(record, opts)
    }
    await batch.flush()
    return batch.entries
  }

  // async get (req, opts = {}) {
  //   if (req.lseq || (req.key && req.seq)) {
  //     const record = await this.getBlock(req, opts)
  //     return [record]
  //   } else if (req.id || req.type) {
  //     const records = await this.query('records', { id: req.id, type: req.type })
  //     return records
  //   } else throw new Error('Invalid get request')
  // }

  get (req, opts = {}, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    cb = maybeCallback(cb)
    if (req.lseq || (req.key && req.seq)) {
      this.getBlock(req).then(record => cb(null, [record]), cb)
    } else if (req.id || req.type) {
      this.query('records', req).then(records => cb(null, records), cb)
    }
    return cb.promise
  }

  async getBlock (req, opts = {}) {
    // Resolve the request through the indexer. This allows to use
    // either an lseq or key and seq.
    if (!req.key || !req.seq || !req.lseq) {
      req = await new Promise((resolve, reject) => {
        this._indexer.resolveBlock(req, (err, req) => {
          err ? reject(err) : resolve(req)
        })
      })
    }

    const { key, seq } = req
    const feed = this.feed(key)
    if (!feed) throw new Error('Key not found')

    if (seq === 0) throw new Error('Cannot get block 0 because it is the header')
    // TODO: Support different decoders per feed type (to support hyperdrive).
    const block = await feed.get(seq)
    const decoded = RecordEncoder.decode(block, req)

    if (opts.upcast === false) {
      return decoded
    }

    try {
      const record = new Record(this.schema, decoded)
      return record
    } catch (err) {
      if (opts.wait === false) throw err
      if (opts._isRetrying) throw err
      await this.sync('root')
      opts._isRetrying = true
      return this.getBlock(req, opts)
    }
  }

  createGetStream (opts) {
    const self = this
    return new Transform({
      transform (req, cb) {
        self.getBlock(req, opts).then(res => cb(null, res), cb)
      }
    })
  }

  getRecord (req, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    if (!cb) return this.getBlock(req, opts)
    else this.getBlock(req, opts).then(record => cb(null, record), cb)
  }

  // TODO: Remove. Replaced with getRecord.
  loadRecord (...args) {
    return this.getRecord(...args)
  }

  async putFeed (key, info = {}) {
    if (!info.type) info.type = FEED_TYPE_ROOT
    if (!Buffer.isBuffer(key)) key = Buffer.from(key, 'hex')
    info.key = key.toString('hex')
    const record = {
      type: TYPE_FEED,
      id: deriveId(hcrypto.discoveryKey(key)),
      value: info
    }
    const ret = await this.put(record)
    await this.sync('root')
    return ret
  }

  async putType (type) {
    // validate, will throw if type spec is invalid
    type = new Type(this.schema, type)
    const record = {
      type: TYPE_TYPE,
      id: deriveId(type.address),
      value: type.toJSON()
    }
    const ret = await this.put(record)
    await this.sync('root')
    return ret
  }

  getType (address) {
    return this.schema.getType(address)
  }

  async query (name, args, opts = {}) {
    const query = new Query(this, name, args, opts)
    return query.collect()
  }

  createQueryStream (name, args, opts = {}) {
    const query = new Query(this, name, args, opts)
    return query.stream()
  }

  subscribe (name, opts) {
    if (this._subscriptions.has(name)) return this._subscriptions.get(name)
    const sub = new Subscription(this, name, opts)
    this._subscriptions.set(name, sub)
    return sub
  }

  sync (views, cb) {
    if (typeof views === 'function') {
      cb = views
      views = null
    }
    cb = maybeCallback(cb)

    // const timeout = setTimeout(() => {
    //   cb(new Error('Sync timeout')
    // }, SYNC_TIMEOUT)

    process.nextTick(() => {
      this._kappa.ready(views, () => {
        // clearTimeout(timeout)
        cb()
      })
    })

    return cb.promise
  }

  async update () {
    // Check all feeds for updates
    try {
      const updates = this.feeds().map(feed => feed.update({ ifAvailable: true, wait: false }))
      await Promise.all(updates)
    } catch (err) {}
    // Wait for the indexer and the views to sync
    await this.sync()
  }

  /**
   * Get status information for this collection.
   * @returns {CollectionStatus}
   */
  status (cb) {
    if (!this.opened) return { opened: false }
    const feeds = this.feeds().map(feed => feedStatus(this, feed))
    const kappa = this._kappa.getState()
    const network = this._workspace.network.status(this.discoveryKey)
    const config = this.getConfig()
    const status = {
      name: this.name,
      opened: true,
      key: datEncoding.encode(this.key),
      discoveryKey: datEncoding.encode(this.discoveryKey),
      rootKey: datEncoding.encode(this.key),
      localKey: datEncoding.encode(this.localKey),
      feeds,
      kappa,
      network,
      config
      // localDrive: localDriveKey
    }
    if (cb) process.nextTick(cb, null, status)
    return status
  }

  createEventStream (opts) {
    return this._eventStream.createReadStream(opts)
  }

  // Internal methods

  _setupDefaultViews () {
    // Subscribe for new feeds and types.
    const rootViewOpts = {
      batch: false,
      upcast: false
      // filterFeed: (key) => {
      //   const info = this.feedInfo(key)
      //   const ret = info && info.type === FEED_TYPE_ROOT
      //   return ret
      // }
    }
    const rootViewMap = async record => {
      // The root view has the upcast opt set to false, which means that
      // invalid records end here too (invalid = type unknown usually).
      // we just ignore them as we care for records of type "feed" and "type" only.
      try {
        record = new Record(this.schema, record)
        if (record.hasType(TYPE_FEED)) {
          this._initFeed(record.value.key, record.value).catch(this._onerror)
        }
        if (record.hasType(TYPE_TYPE)) {
          this._addTypeFromRecord(record)
        }
      } catch (err) {}
    }
    this.use('root', { map: rootViewMap }, rootViewOpts)

    this.use('kv', createKvView(
      this._leveldb('view.kv')
    ))

    this.use('records', createRecordsView(
      this._leveldb('view.records'),
      this,
      {
        schema: this.schema
      }
    ))
    this.use('index', createIndexView(
      this._leveldb('view.index'),
      this,
      {
        schema: this.schema
      }
    ))
    this.use('history', createHistoryView(
      this._leveldb('view.history'),
      this
    ))

    // this.use('debug', async function (records) {
    //   console.log('MAP', records)
    // })
  }

  _leveldb (name) {
    if (!this._id) {
      console.error(new Error().stack)
      throw new Error('LevelDB created too early')
    }
    const prefix = this._id
    const dbName = 'c/' + prefix + '/' + name
    return this._workspace.LevelDB(dbName)
  }

  _feedName (type) {
    // dat-sdk (through dat-encoding) considers every string that
    // contains a 32-byte hex string a key, so we have to add a
    // non-hex character somewhere.
    const id = this.key.slice(0, 16).toString('hex') + '-' + this.key.slice(16).toString('hex')
    return `sonar-collection-${id}-${type}`
  }

  _prepare () {

  }

  async _open () {
    // Init workspace
    // ====
    if (!this._workspace.opened) await this._workspace.open()

    // Init core types
    // ====
    // TODO: Check for version updates.
    // TODO: Decide whether to store core types in the feeds as well.
    this.schema.addTypes(CORE_TYPE_SPECS, { onchange: false })

    // Init root feed
    // This is a bit more manual than other feeds, because
    // our local resources are not yet initialized
    // ====
    const rootInfo = { type: FEED_TYPE_ROOT }
    this._rootFeed = await this._initFeed(this._keyOrName, rootInfo, { index: false })
    this._id = deriveId(this._rootFeed.discoveryKey)
    if (this._keyOrName !== this._rootFeed.key.toString('hex')) {
      this._name = this._keyOrName
    }

    // Init local state
    // ====
    const leveldbs = {
      indexer: this._leveldb('i'),
      state: this._leveldb('l')
    }
    this._localState = new LevelMap(leveldbs.state)
    this._feedInfo = this._localState.prefix('feeds')
    await Promise.all([
      this._localState.open(),
      this._feedInfo.open()
    ])

    // Save root feed info
    // Normally this happens in _initFeed() automatically, but for the
    // root feed the local state is only available now
    const rootKey = this.key.toString('hex')
    rootInfo.key = rootKey
    if (!this._feedInfo.has(rootKey)) {
      this._feedInfo.set(rootKey, rootInfo)
    }

    // Set default type namespace to root feed key
    this.schema.setDefaultNamespace(this._id)
    // Load persisted schema
    const storedSchema = this._localState.get('schema')
    if (storedSchema) {
      this.schema.addTypes(storedSchema, { onchange: false })
    }

    // Init indexer
    // ====
    this._indexer = new Indexer({
      loadValue: false,
      db: leveldbs.indexer
    })
    this._indexer.on('update', () => {
      this.emit('update', this.length)
    })
    this._indexer.addReady(this._rootFeed, { scan: true })


    // Init default views
    // ====
    this._setupDefaultViews()

    // Init local feed
    // ====
    if (this._rootFeed.writable) {
      this._localFeed = this._rootFeed
    } else {
      this._localFeed = await this._initFeed(this._feedName(FEED_TYPE_ROOT), rootInfo)
    }

    // Publish about ourselves in our own feed
    if (!(await this._localFeed.has(1))) {
      await this.putFeed(this.localKey, this.feedInfo(this.localKey))
    }

    // Init network configuration.
    const config = this._localState.get('config')
    if (config) {
      await this.configure(config, false)
    } else {
      await this.configure(DEFAULT_CONFIG, true)
    }

    // Load feeds and add them to the kappa.
    await Promise.all(
      this._feedInfo
        .values()
        .map(info => this._initFeed(info.key, info))
    )

    // Give plugins a chance to open
    const [openPromises, addOpenPromise] = promiseFactory()
    this.emit('opening', addOpenPromise)
    await Promise.all(openPromises)

    // Emit open event
    this.emit('open')
    this.log.debug(`Collection open: ${pretty(this.key)}`)

    // Alternative approach: Don't store feeds and types locally at all.
    // Query the collection itself. This is nicer, likely.
    // const feedRecords = await this.query('records', { type: 'sonar.feed' })
    // for (const feedRecord of feedRecords) {
    //   this._addFeedFromRecord(feedRecord)
    // }
    //
    // Load types and add them to the schema.
    // const typeRecords = await this.query('records', { type: 'sonar.type' })
    // for (const typeRecord of typeRecords) {
    //   this._addTypeFromRecord(typeRecord)
    // }
    //
  }

  async _close () {
    if (!this.opening && !this.opened) return
    if (this.opening) await this.open()
    // Wait until all batches are complete
    await this.lock()
    await new Promise((resolve) => {
      this._kappa.close(resolve)
    })
    await new Promise((resolve) => {
      this._indexer.close(resolve)
    })
    this._eventStream.destroy()
  }

  async _initFeed (keyOrName, info = {}, opts = {}) {
    // console.log('initFeed', { keyOrName, info, stack: new Error().stack })
    const feed = this._workspace.Hypercore(keyOrName)
    if (!feed.opened) await feed.ready()
    const hkey = feed.key.toString('hex')
    // Don't do anything for feeds already opened
    if (this._feeds.has(hkey)) return this._feeds.get(hkey)

    // TODO: Deal with feed types again :)
    if (info.type && info.type === 'hyperdrive') return

    feed.on('download', (seq) => {
      this.emit('feed-update', feed)
    })
    feed.on('append', () => {
      this.emit('feed-update', feed)
    })
    feed.on('remote-update', () => {
      this.emit('remote-update', feed)
    })

    // If the feed is unknown add it to the feed store.
    info.key = hkey
    if (this._feedInfo && !this._feedInfo.has(hkey)) {
      this._feedInfo.set(hkey, info)
    }

    this._feeds.set(hkey, feed)

    // Inititialize feed and add to local db
    if (feed.writable) {
      await this._initLocalFeed(feed, info)
    } else {
      await this._initRemoteFeed(feed, info)
    }

    if (opts.index !== false) {
      this._indexer.addReady(feed, { scan: true })
    }

    // TODO: Start to not download everything, always.
    // Note: null as second argument is needed, see
    // https://github.com/geut/hypercore-promise/issues/8
    feed.download({ start: 0, end: -1 }, null)

    this.emit('feed', feed, info)
    // this.log.info('Added feed %o', info)

    return feed
  }

  async _initRemoteFeed (feed, info) {
    if (feed.writable) throw new Error('Remote feed cannot be writable')
    // If the type is set, there's nothing to to do.
    if (info.type) return

    const hkey = feed.key.toString('hex')

    const onheader = async buf => {
      const header = Header.decode(buf)
      const type = header.type
      this._feedInfo.update(hkey, info => {
        info.type = type
        info.header = header
        return info
      })
      await this._feedInfo.flush()
    }

    // Try to load the header.
    try {
      const buf = await feed.get(0, { wait: false })
      await onheader(buf)
    } catch (err) {
      // Try to load the header, waiting
      feed.get(0, { wait: true }).then(buf => {
        onheader(buf).catch(this._onerror)
      }).catch(() => {})
    }
  }

  async _initLocalFeed (feed, info = {}) {
    if (!feed.writable) throw new Error('Local feed must be writable')
    // Feed was already initialized
    if (feed.length) return
    // No type is error
    if (!info.type) throw new Error('Type is required for new feeds')

    // Append header if writable and empty
    // const hkey = feed.key.toString('hex')
    await feed.append(Header.encode({
      type: info.type
    }))
  }

  _addTypeFromRecord (typeRecord) {
    this.schema.addType(typeRecord.value)
  }

  [inspect] (depth, opts) {
    const { stylize = str => str, indentationLvl } = opts
    const indent = ' '.repeat(indentationLvl || 0)
    const h = str => stylize(str, 'special')
    const s = str => stylize(str)
    const n = str => stylize(str, 'number')
    const fmtkey = key => key ? key.toString('hex') : ''

    const feeds = this.feeds().map(feed => {
      const info = this.feedInfo(feed.key)
      const meta = feed.writable ? '*' : '/' + n(feed.downloaded())
      let str = h(pretty(feed.key)) + s('@') + n(feed.length) + meta
      if (info.name) str += ' ' + info.name
      if (info.type) str += s(` (${info.type})`)
      return str
    }).join(', ')

    return 'Collection(\n' +
          indent + '  opened   : ' + stylize(this.opened, 'boolean') + '\n' +
          indent + '  key      : ' + h(fmtkey(this.key)) + '\n' +
          indent + '  localKey : ' + h(fmtkey(this.localKey)) + '\n' +
          // indent + '  discoveryKey: ' + s(fmtkey(this.discoveryKey)) + '\n' +
          indent + '  id       : ' + s(this._id) + '\n' +
          // indent + '  name     : ' + s(this._name) + '\n' +
          indent + '  feeds    : ' + feeds + '\n' +
          indent + ')'
  }
}

// async function onFeedCreateRemote (feed) {
//   if (feed.writable) throw new Error('Remote feed cannot be writable')
//   const hkey = feed.key.toString('hex')
//   // const info = this._feedInfo.get(hkey)
//   // If a type is set the feed was added.
//   // if (info.type) {
//   //   this._kappa.addFeed(feed)
//   //   return
//   // }

//   const onheader = async buf => {
//     const header = Header.decode(buf)
//     const type = header.type
//     this._feedInfo.update(hkey, info => {
//       info.type = type
//       info.header = header
//       return info
//     })
//     await this._feedInfo.flush()
//   }

//   // Try to load the header.
//   try {
//     const buf = await feed.get(0, { wait: false })
//     await onheader(buf)
//   } catch (err) {
//     // Try to load the header, waiting
//     feed.get(0, { wait: true }).then(buf => {
//       onheader(buf).catch(this._onerror)
//       // this._kappa.addFeed(feed)
//     }).catch(() => {})
//   }
// }

// async function onFeedCreateLocal (feed, info = {}) {
//   if (!feed.writable) throw new Error('Local feed must be writable')
//   // Feed was already initialized
//   if (feed.length) return

//   if (!info.type) throw new Error('Type is required for new feeds')

//   // Append header if writable and empty
//   const hkey = feed.key.toString('hex')
//   await feed.append(Header.encode({
//     type: info.type
//   }))

//   await this.putFeed(hkey, info)
//   // Append feed record once the collection is fully opened
//   // this.ready(() => {
//   //   this.putFeed(hkey, info).catch(this._onerror)
//   // })
// }

class Batch {
  constructor (collection) {
    this.collection = collection
    this.entries = []
    this.synced = false
    this.locked = null
  }

  async _lock () {
    if (this.locked === null) this.locked = await this.collection.lock()
  }

  _unlock () {
    const locked = this.locked
    this.locked = null
    if (locked !== null) locked()
  }

  async put (record, opts) {
    return this._append(record, opts)
  }

  async del ({ id, type }, opts) {
    const record = { id, type, deleted: true }
    return this._append(record, opts)
  }

  async _append (record, opts = {}) {
    if (!this.locked) await this._lock()
    if (!this.synced) {
      await this.collection.sync('kv')
      this.synced = true
    }

    if (!record.id) record.id = uuid()

    // Upcast record
    record = new Record(this.collection.schema, record)

    // Set feed, links, timestamp
    record.links = await this._getLinks(record, opts)
    const feed = await this._findFeed(record, opts)
    record.key = feed.key.toString('hex')
    record.timestamp = Date.now()

    // Never store value for deleted records
    if (record.deleted) {
      record.value = undefined
    }
    this.entries.push(record)
  }

  async flush () {
    // Sort records into buckets by feed
    const buckets = new ArrayMap()
    for (const record of this.entries) {
      buckets.push(record.key, record)
    }

    // Encode and append the records for each feed
    const promises = Array.from(buckets.entries()).map(async ([key, records]) => {
      const feed = this.collection.feed(key)
      if (!feed) throw new Error('Feed not found: ' + key)
      if (!feed.writable) throw new Error('Feed not writable: ' + key)
      const blocks = records.map(record => RecordEncoder.encode(record.toJSON()))
      await feed.append(blocks)
      return records
    })
    await Promise.all(promises)
    this._unlock()
  }

  async _findFeed (record, opts) {
    return this.collection._localFeed
    // TODO: Support specifying the feed or type.
    // if (record.hasType(TYPE_FEED) || record.hasType(TYPE_TYPE)) {
    //   return this.collection._localFeed
    // } else {
    //   return this.collection._dataFeed
    // }
  }

  async _getLinks (record) {
    // Find links
    const links = await new Promise((resolve, reject) => {
      this.collection.view.kv.getLinks(record, (err, links) => {
        if (err && err.status !== 404) return reject(err)
        resolve(links || [])
      })
    })
    // TODO: Track links within this batch, that's the whole idea :)
    return links
  }
}

class Subscription {
  constructor (collection, name, opts) {
    // if (typeof opts === 'function') {
    //   opts = { map: opts }
    // }
    // this.collection = collection
    this.sub = collection._indexer.createSubscription(name, opts)
    this.name = name
    this.opts = opts
    this.pullOpts = {
      loadValue: (req, next) => {
        if (req.seq === 0) next(null)
        else {
          collection.getRecord(req, (err, record) => {
            if (err) next(null)
            else next(record)
          })
        }
      }
    }
  }

  async pull (opts = {}) {
    opts = { ...this.pullOpts, ...opts }
    return new Promise((resolve, reject) => {
      this.sub.pull(opts, (err, batch) => {
        if (err) return reject(err)
        resolve(batch)
      })
    })
  }

  async ack (cursor) {
    return new Promise((resolve, reject) => {
      this.sub.setCursor(cursor, err => err ? reject(err) : resolve())
    })
  }

  stream (opts = {}) {
    opts = { ...this.pullOpts, ...opts }
    if (opts.live !== false) opts.live = true
    return this.sub.createPullStream(opts)
  }
}

class Query {
  constructor (collection, name, args, opts) {
    this.collection = collection
    this.name = name
    this.args = args
    this.opts = opts
    this.proxy = this.collection.createGetStream()
  }

  start () {
    if (this.started) return
    this.started = true

    if (this.opts.remote) this._queryRemote()
    else this._queryLocal()
  }

  stream () {
    this.start()
    return this.proxy
  }

  collect () {
    this.start()
    if (this.opts.live) throw new Error('Cannot collect live queries')
    return collectAsync(this.proxy)
  }

  _queryLocal () {
    const self = this
    const { name, args, opts } = this
    const queryFn = this.collection._queryHandlers.get(name)
    if (!queryFn) {
      this.proxy.destroy(new Error('Invalid query name: ' + this.name))
      return
    }

    if (opts.waitForSync) {
      this.collection.sync(createStream)
    } else {
      createStream()
    }

    function createStream () {
      const qs = queryFn(args, opts)
      qs.once('sync', () => self.proxy.emit('sync'))
      qs.on('error', err => self.proxy.emit('error', err))
      pump(qs, self.proxy)
    }
  }

  _queryRemote () {
    this.proxy.destroy('Remote queries are not yet supported')
  }
}

class ArrayMap extends Map {
  push (key, value) {
    if (!this.has(key)) this.set(key, [])
    this.get(key).push(value)
  }
}

async function collectAsync (stream) {
  return new Promise((resolve, reject) => {
    collectStream(stream, (err, results) => {
      if (err) reject(err)
      else resolve(results)
    })
  })
}

function feedStatus (collection, feed) {
  const info = collection.feedInfo(feed.key)
  const status = {
    key: datEncoding.encode(feed.key),
    discoveryKey: datEncoding.encode(feed.discoveryKey),
    writable: feed.writable,
    length: feed.length,
    byteLength: feed.byteLength,
    type: info.type
  }
  if (feed.opened) {
    status.downloadedBlocks = feed.downloaded(0, feed.length)
    status.stats = feed.stats
  }
  return status
}

function promiseFactory () {
  const promises = []
  return [promises, addPromise]
  function addPromise (promise) {
    if (promise && typeof promise === 'function') {
      promises.push(promise())
    } else if (promise && typeof promise === 'object' && promise.then) {
      promises.push(promise)
    } else {
      const cb = maybeCallback()
      promises.push(cb.promise)
      return cb
    }
  }
}

module.exports = Collection

const hcrypto = require('hypercore-crypto')
const mutexify = require('mutexify/promise')
const datEncoding = require('dat-encoding')
const pretty = require('pretty-hash')
const inspect = require('inspect-custom-symbol')
const pump = require('pump')
const collectStream = require('stream-collector')
const { Transform } = require('streamx')
const {
  NanoresourcePromise: Nanoresource
} = require('nanoresource-promise/emitter')
const Kappa = require('kappa-core')
const Indexer = require('kappa-sparse-indexer')

const { RecordVersion, Type, Schema } = require('@arsonar/common')
const BlockCache = require('./block-cache')
const LevelMap = require('./utils/level-map')
const EventStream = require('./utils/eventstream')
const Workspace = require('./workspace')
const RecordEncoder = require('./record-encoder')
const { Header } = require('./messages')
const { noop, uuid, once, deriveId, maybeCallback } = require('./util')
const createKvView = require('../views/kv')
const createRecordsView = require('../views/records')
const createIndexView = require('../views/indexes')
const createHistoryView = require('../views/history')
const CORE_TYPE_SPECS = require('./types.json')
const Files = require('./file')

const FEED_TYPE_ROOT = 'sonar.root'

const TYPE_FEED = 'sonar/feed'
const TYPE_TYPE = 'sonar/type'

const DEFAULT_CONFIG = {
  share: true
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
      onchange: schema => {
        if (!this._localState) return
        this._localState.set('schema', schema.toJSON())
        this.emit('schema-update', schema)
      }
    })

    this.files = new Files(this)

    this._feeds = new Map()

    // Set in _open()
    this._indexer = null
    this._localState = null
    this._feedInfo = null

    this._kappa = new Kappa()
    this._queryHandlers = new Map()
    this._onerror = err => err && this.emit('error', err)
    this._subscriptions = new Map()
    this.lock = opts.lock || mutexify()

    this._eventStream = new EventStream()
    this._blockCache = new BlockCache(this.workspace.corestore, {
      map: (block, req) => this._decodeBlock(block, req)
    })

    // Push some events into event streams
    // Event streams are an easy way to forward events over RPC or HTTP.
    this._forwardEvent('open')
    this._forwardEvent('update', lseq => ({ lseq }))
    this._forwardEvent('feed', (feed, info) => ({ ...info }))
    this._forwardEvent('schema-update', () => ({}))
  }

  _forwardEvent (event, map) {
    if (!map) map = data => data
    this.on(event, (...args) => this._pushEvent(event, map(...args)))
  }

  _pushEvent (event, data) {
    this.log.trace('event: ' + event)
    this._eventStream.write({ event, data })
  }

  // Public API

  get writable () {
    return this._localFeed && this._localFeed.writable
  }

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
    return this._name || this._opts.name || this.id
  }

  get workspace () {
    return this._workspace
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
      maxBatch: opts.maxBatch || 1000
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
        // filter out header messages
        if (req.seq !== undefined && !req.seq) {
          messages[i] = undefined
          return ondone()
        }
        self.getBlock(req, getOpts).then(
          record => {
            if (record) messages[i] = record
            else messages[i] = undefined
            ondone()
          },
          err => {
            if (err) messages[i] = undefined
            ondone()
          }
        )
      })
      function ondone () {
        if (--pending !== 0) return
        messages = messages.filter(m => m)
        next(messages.filter(m => m))
      }
    }

    const flow = this._kappa.use(
      name,
      this._indexer.createSource(sourceOpts),
      view,
      opts
    )
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

  replicate (...args) {
    return this._workspace.corestore.replicate(...args)
  }

  async configure (configuration = {}, save = true) {
    let promise
    if (configuration.share !== false) {
      promise = this._workspace.network.configure(this.discoveryKey, {
        announce: true,
        lookup: true
      })
    } else {
      promise = this._workspace.network.configure(this.discoveryKey, {
        announce: false,
        lookup: false
      })
    }
    // if (promise) promise.then(() => console.log('swarm configure resolved')).catch(console.error)

    if (save) {
      await this._workspace._saveCollection(this, configuration)
    }
  }

  getConfig () {
    return this._workspace._getCollectionConfig(this)
  }

  async put (record, opts = {}) {
    if (!(record instanceof RecordVersion)) {
      record = new RecordVersion(this.schema, record)
    }
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

  createBatchStream (opts = {}) {
    const flushAfter = opts.flushAfter || 1000
    let batch = new Batch(this)
    let i = 0
    const flushStream = async () => {
      try {
        await batch.flush()
        for (const entry of batch.entries) {
          stream.push(entry)
        }
        batch = new Batch(this)
      } catch (err) {
        stream.destroy(err)
      }
    }
    var stream = new Transform({
      async transform (record, cb) {
        if (!record) {
          await flushStream()
          this.push(null)
          cb()
          return
        }
        try {
          await batch._append(record)
          if (++i % flushAfter === 0) {
            await flushStream()
          }
          cb()
        } catch (err) {
          cb(err)
        }
      },
      final (cb) {
        flushStream()
          .then(() => cb())
          .catch(cb)
          .finally(() => this.push(null))
      },
      destroy (cb) {
        if (batch) batch._unlock()
        cb()
      }
    })
    return stream
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

  _decodeBlock (block, req) {
    const decodedBlock = RecordEncoder.decode(block, req)
    return decodedBlock
  }

  async resolveBlock (req, opts = {}) {
    if (req.address) {
      const [key, seq] = req.address.split('@')
      req.key = key
      req.seq = seq
    }
    // Resolve the request through the indexer. This allows to use
    // either an lseq or key and seq.
    if (!req.key || !req.seq || !req.lseq) {
      req = await new Promise((resolve, reject) => {
        this._indexer.resolveBlock(req, (err, req) => {
          err ? reject(err) : resolve(req)
        })
      })
    }
    return req
  }

  async getBlock (req, opts = {}) {
    if (!this.opened && !this.opening) await this.open()
    if (opts.wait === undefined) opts.wait = true

    req = await this.resolveBlock(req)

    const block = await this._blockCache.getBlock(req.key, req.seq)
    if (!block) return null
    if (opts.upcast === false) {
      return block
    }
    if (req.lseq) block.lseq = req.lseq
    try {
      try {
        const record = new RecordVersion(this.schema, block)
        return record
      } catch (err) {
        if (opts.wait === false) throw err
        await this.sync('root')
        const record = new RecordVersion(this.schema, block)
        return record
      }
    } catch (err) {
      this.log.error(`Failed to load: ${JSON.stringify(req)}: ${err.message}`)
      throw err
    }
  }

  createGetStream (opts) {
    const self = this
    return new Transform({
      transform (req, cb) {
        self
          .get(req, opts)
          .catch(() => {
            // Ignore missing records.
            // TODO: Check if this is what we want.
            cb()
          })
          .then(records => {
            records.forEach(record => record && this.push(record))
            cb()
          })
      }
    })
  }

  get (req, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    return maybe(cb, async () => {
      let list = []
      if ((req.key && req.seq) || req.lseq || req.address) {
        try {
          const block = await this.getBlock(req, opts)
          if (block) list.push(block)
        } catch (err) {
          // TODO: throw or log?
        }
      } else if (req.type || req.id || req.path) {
        list = await this.query('records', req)
      } else {
        throw new Error('Invalid request')
      }
      if (opts.single) return list[0]
      return list
    })
  }

  // TODO: Remove. Replaced with get.
  loadRecord (args, opts = {}, cb) {
    return this.getRecord(args, opts, cb)
  }

  // TODO: Remove. Replaced with get.
  getRecord (args, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    opts.single = true
    return this.get(args, opts, cb)
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
      const updates = this.feeds().map(feed =>
        feed.update({ ifAvailable: true, wait: false })
      )
      await Promise.all(updates)
    } catch (err) {}

    let resync = true

    this.on('feed-update', () => {
      resync = true
    })

    while (resync) {
      resync = false
      await this.sync()
    }
  }

  /**
   * Get status information for this collection.
   * @returns {CollectionStatus}
   */
  status (cb) {
    const feeds = this.feeds().map(feed => feedStatus(this, feed))
    const kappa = this._kappa.getState()
    const network = this._workspace.network.status(this.discoveryKey)
    const config = this.getConfig() || DEFAULT_CONFIG
    const status = {
      opened: this.opened,
      name: this.name,
      key: this.key && datEncoding.encode(this.key),
      discoveryKey: this.discoveryKey && datEncoding.encode(this.discoveryKey),
      rootKey: this.key && datEncoding.encode(this.key),
      localKey: this.localKey && datEncoding.encode(this.localKey),
      id: this.id,
      length: this.length,
      feeds,
      kappa,
      network,
      config
    }
    this.emit('onstatus', status)
    if (cb) process.nextTick(cb, null, status)
    return status
  }

  createEventStream (opts) {
    return this._eventStream.createReadStream(opts)
  }

  reindex (views = null) {
    return new Promise((resolve, reject) => {
      this._kappa.reset(views, err => {
        if (err) return reject(err)
        resolve()
      })
    })
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
        record = new RecordVersion(this.schema, record)
        if (record.hasType(TYPE_FEED)) {
          const opts = { origin: record.key }
          this._initFeed(record.value.key, record.value, opts).catch(
            this._onerror
          )
        }
        if (record.hasType(TYPE_TYPE)) {
          this._addTypeFromRecord(record)
        }
      } catch (err) {}
    }
    this.use('root', { map: rootViewMap }, rootViewOpts)

    this.use('kv', createKvView(this._leveldb('view.kv')))

    this.use(
      'records',
      createRecordsView(this._leveldb('view.records'), this, {
        schema: this.schema
      })
    )
    this.use(
      'index',
      createIndexView(this._leveldb('view.index'), this, {
        schema: this.schema
      })
    )
    this.use('history', createHistoryView(this._leveldb('view.history'), this))

    // this.use('debug', async function (records) {
    //   console.log('MAP', records)
    // })
  }

  _leveldb (name) {
    if (!this._id) {
      throw new Error('LevelDB created too early')
    }
    const prefix = this._id
    const dbName = 'c/' + prefix + '/' + name
    return this._workspace.LevelDB(dbName)
  }

  _feedName (name) {
    // hyper-sdk (through dat-encoding) considers every string that
    // contains a 32-byte hex string a key, so we have to add a
    // non-hex character somewhere.
    const id =
      this.key.slice(0, 16).toString('hex') +
      '-' +
      this.key.slice(16).toString('hex')
    return `sonar-collection-${id}-${name}`
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
    this._rootFeed = await this._initFeed(this._keyOrName, rootInfo)
    this._id = deriveId(this._rootFeed.discoveryKey)

    if (this._keyOrName !== this._rootFeed.key.toString('hex')) {
      this._name = this._keyOrName
    } else if (this._opts.name) {
      this._name = this._opts.name
    } else {
      this._name = this._id
    }

    // Init local state
    // ====
    const leveldbs = {
      indexer: this._leveldb('i'),
      state: this._leveldb('l')
    }
    this._localState = new LevelMap(leveldbs.state)
    this._feedInfo = this._localState.prefix('feeds')
    await Promise.all([this._localState.open(), this._feedInfo.open()])

    // Save root feed info
    // Normally this happens in _initFeed() automatically, but for the
    // root feed the local state is only available now
    const rootKey = this.key.toString('hex')
    rootInfo.key = rootKey
    if (!this._feedInfo.has(rootKey)) {
      this._feedInfo.set(rootKey, rootInfo)
    }

    // Set default type namespace to root feed key
    this.schema.setDefaultNamespace(this.id)
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
    if (this._opts.localKey) {
      await this._setLocalWriter(this._opts.localKey)
    } else if (this._opts.writable !== false) {
      if (this._rootFeed.writable) {
        await this._setLocalWriter(this._rootFeed.key)
      } else {
        await this._setLocalWriter(this._feedName(FEED_TYPE_ROOT))
      }
    }

    // Init network configuration.
    const config = this.getConfig()
    if (config) {
      await this.configure(config, false)
    } else {
      await this.configure(DEFAULT_CONFIG, false)
    }

    // Load feeds and add them to the kappa.
    await Promise.all(
      this._feedInfo.values().map(info => this._initFeed(info.key, info))
    )

    // Give plugins a chance to open
    const [openPromises, addOpenPromise] = promiseFactory()
    this.emit('opening', addOpenPromise)
    await Promise.all(openPromises)

    // Emit open event
    this.log.debug(`Collection open: ${pretty(this.key)}`)
    process.nextTick(() => this.emit('open'))

    // Save new collection (that don't have a saved config yet) right after it's opened.
    if (!config) {
      this._workspace._saveCollection(this, DEFAULT_CONFIG)
    }

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

  async _setLocalWriter (keyOrName, info = {}) {
    info = { type: FEED_TYPE_ROOT, ...info }
    this._localFeed = await this._initFeed(keyOrName, info)

    // Publish about ourselves in our own feed
    if (!(await this._localFeed.has(1))) {
      await this.putFeed(this.localKey, this.feedInfo(this.localKey))
    }
  }

  async _close () {
    if (!this.opening && !this.opened) return
    if (this.opening) await this.open()
    // Wait until all batches are complete
    await this.lock()
    await new Promise(resolve => {
      // Ignore closing errors for now.
      this._kappa.on('error', () => {})
      this._kappa.close(resolve)
    })
    // wait a tick
    await new Promise(resolve => process.nextTick(resolve))
    await new Promise(resolve => {
      this._indexer.close(resolve)
    })
    this.emit('close')
    this._eventStream.destroy()
  }

  async _initFeed (keyOrName, info = {}, opts = {}) {
    // Open the feed if it's not yet opened
    // if (this._feeds.has(keyOrName)) return this._feeds.get(keyOrName)
    const feed = this._workspace.Hypercore(keyOrName)
    if (!feed.opened) await feed.ready()
    const hkey = feed.key.toString('hex')
    // Recheck if feed is opened (if it was opened by name first)
    if (this._feeds.has(hkey)) return this._feeds.get(hkey)

    // Forward some events
    feed.on('download', seq => {
      // Forward some events
      this.emit('feed-update', feed, 'download', seq)
    })
    feed.on('append', () => {
      this.emit('feed-update', feed, 'append')
    })
    feed.on('remote-update', () => {
      this.emit('remote-update', feed)
    })
    feed.on('peer-open', peer => {
      this.emit('peer-open', feed, peer)
    })

    // If the feed is unknown add it to the local feed store.
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

    // Add feed to indexer
    // TODO: Change default to false?
    let index = false
    if (opts.index === true) index = true
    if (opts.index === undefined && info.type === FEED_TYPE_ROOT) index = true
    if (index && this._indexer) {
      this._indexer.addReady(feed, { scan: true })
    }

    // TODO: Start to not download everything, always.
    // Note: null as second argument is needed, see
    // https://github.com/geut/hypercore-promise/issues/8
    if (index) {
      feed.download({ start: 0, end: -1 }, null)
    }

    // Look for the feed in the swarm if added by myself
    if (!opts.origin || opts.origin === this.localKey.toString('hex')) {
      const networkPromise = this._workspace.network.configure(
        feed.discoveryKey,
        {
          announce: true,
          lookup: true
        }
      )
    }

    this.emit('feed', feed, info)
    this.log.debug(
      `init feed [${info.type}] ${pretty(feed.key)} @ ${feed.length}`
    )

    return feed
  }

  async _initRemoteFeed (feed, info) {
    if (feed.writable) throw new Error('Remote feed cannot be writable')
    // If the type is set, there's nothing to to do.
    if (info.type) return

    const hkey = feed.key.toString('hex')

    // When header is loaded, parse type and save locally.
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

    try {
      // Try to load the header without waiting
      const buf = await feed.get(0, { wait: false })
      await onheader(buf)
    } catch (err) {
      // Try to load the header with waiting, but return now
      feed
        .get(0, { wait: true })
        .then(buf => {
          onheader(buf).catch(this._onerror)
        })
        .catch(noop)
    }
  }

  async _initLocalFeed (feed, info = {}) {
    if (!feed.writable) throw new Error('Local feed must be writable')
    // Feed was already initialized
    if (feed.length) return
    // No type is error for new local feeds
    if (!info.type) throw new Error('Type is required for new feeds')

    // Append header if writable and empty
    // TODO: Support subtypes
    await feed.append(
      Header.encode({
        type: info.type
      })
    )
  }

  _addTypeFromRecord (typeRecord) {
    try {
      this.schema.addType(typeRecord.value)
    } catch (err) {
      // TODO: Where should errors that come from bad DB records go?
      this.log.error(
        `Failed to load type with ID ${typeRecord.id}into schema: ${err.message}`
      )
      this.emit('error', err)
    }
  }

  [inspect] (depth, opts) {
    const { stylize = str => str, indentationLvl } = opts
    const indent = ' '.repeat(indentationLvl || 0)
    const h = str => stylize(str, 'special')
    const s = str => stylize(str)
    const n = str => stylize(str, 'number')
    const fmtkey = key => (key ? key.toString('hex') : '')

    const feeds = this.feeds()
      .map(feed => {
        const info = this.feedInfo(feed.key)
        const meta = feed.writable ? '*' : '/' + n(feed.downloaded())
        let str = h(pretty(feed.key)) + s('@') + n(feed.length) + meta
        if (info.name) str += ' ' + info.name
        if (info.type) str += s(` (${info.type})`)
        return str
      })
      .join(', ')

    return (
      'Collection(\n' +
      indent +
      '  opened   : ' +
      stylize(this.opened, 'boolean') +
      '\n' +
      indent +
      '  key      : ' +
      h(fmtkey(this.key)) +
      '\n' +
      indent +
      '  localKey : ' +
      h(fmtkey(this.localKey)) +
      '\n' +
      // indent + '  discoveryKey: ' + s(fmtkey(this.discoveryKey)) + '\n' +
      indent +
      '  id       : ' +
      s(this._id) +
      '\n' +
      // indent + '  name     : ' + s(this._name) + '\n' +
      indent +
      '  feeds    : ' +
      feeds +
      '\n' +
      indent +
      ')'
    )
  }
}

/**
 * Helper class for append operations (put and del).
 */
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
    const record = new RecordVersion(this.collection.schema, { id, type, deleted: true })
    return this._append(record, opts)
  }

  async _append (record, opts = {}) {
    try {
      record = new RecordVersion(this.collection.schema, record)
      if (!this.locked) await this._lock()
      const id = record.id || uuid()

      // Set feed, links, timestamp
      const links = await this._getLinks(record, opts)
      const feed = this._findFeed(record, opts)

      record = {
        ...record.toJSON(),
        id,
        key: feed.key.toString('hex'),
        timestamp: Date.now(),
        links
      }
      // Never store value for deleted records
      if (record.deleted) {
        record.value = undefined
      }

      // Upcast record
      // Throws an error if the record is invalid.
      // TODO: Currently it only checks if id and value are non-empty and type is valid
      // type in the schema.
      record = new RecordVersion(this.collection.schema, record)
      this.entries.push(record)
    } catch (err) {
      console.log('err', err)
      this._unlock()
      throw err
    }
  }

  async flush () {
    // Sort records into buckets by feed
    // buckets will look like this:
    // { key1: [record1, record4], key2: [record2, record3] }
    const buckets = new ArrayMap()
    for (const record of this.entries) {
      buckets.push(record.key, record)
    }

    // Encode and append the records for each feed
    const promises = Array.from(buckets.entries()).map(
      async ([key, records]) => {
        const feed = this.collection.feed(key)
        if (!feed) throw new Error('Feed not found: ' + key)
        if (!feed.writable) throw new Error('Feed not writable: ' + key)
        let seq = feed.length - 1
        const blocks = records.map(record =>
          RecordEncoder.encode(record.toJSON())
        )
        await feed.append(blocks)
        for (const record of records) {
          record.inner.seq = ++seq
        }
        return records
      }
    )

    try {
      await Promise.all(promises)
      // Wait for the transaction to "commit".
      // TODO: Make extra-sure that this cannot deadlock.
      await this.collection.sync('kv')
    } finally {
      this._unlock()
    }
  }

  _findFeed (record, opts) {
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
      this.sub.setCursor(cursor, err => (err ? reject(err) : resolve()))
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

    if (opts.waitForSync || opts.sync) {
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

function maybe (cb, asyncFn) {
  if (!cb) return asyncFn()
  else
    asyncFn()
      .then(res => cb(null, res))
      .catch(cb)
}

module.exports = Collection

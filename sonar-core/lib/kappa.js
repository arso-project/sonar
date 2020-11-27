const Indexer = require('kappa-sparse-indexer')
const KappaCore = require('kappa-core')
const collect = require('stream-collector')
const { Transform } = require('streamx')
const pump = require('pump')
const LRU = require('lru-cache')
const Bitfield = require('fast-bitfield')
const { EventEmitter } = require('events')

const { once, through, maybeCallback } = require('./util')

const DEFAULT_MAX_BATCH = 500
const MAX_CACHE_SIZE = 16777216 // 16M

const LEN = Symbol('record-size')

module.exports = class Kappa extends EventEmitter {
  constructor (opts) {
    super()
    const { db, onget, name } = opts

    this._onget = onget
    this._name = name
    this._feeds = new Map()
    this._kappa = new KappaCore()
    this._indexer = new Indexer({
      name: this._name,
      db,
      // Load and decode value.
      loadValue: (req, next) => {
        next(req)
        // this.getBlock(req, (err, message) => {
        //   if (err) return next(null)
        //   next(message)
        // })
      }
    })

    this._kappa.on('state-update', (name, state) => {
      this.emit('state-update', name, state)
    })

    // Cache for records. Max cache size can be set as an option.
    // The length for each record is the buffer length of the serialized record,
    // so the actual cache size will be a bit higher.
    this._recordCache = new LRU({
      max: opts.maxCacheSize || MAX_CACHE_SIZE,
      length (record) {
        return record[LEN] || 64
      }
    })
    // Cache for query bitfields. This will usually take 4KB per bitfield.
    // We cache max 4096 bitfields, amounting to max 16MB bitfield cache size.
    this._queryBitfields = new LRU({
      max: 4096
    })
  }

  use (name, view, opts = {}) {
    const self = this
    if (typeof view === 'function') {
      view = {
        map: view
      }
    }

    const sourceOpts = {
      maxBatch: opts.maxBatch || DEFAULT_MAX_BATCH
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
        self.getBlock(req, getOpts, (err, record) => {
          if (err) messages[i] = undefined
          else messages[i] = record
          if (--pending === 0) next(messages.filter(m => m))
        })
      })
    }

    return this._kappa.use(name, this._indexer.createSource(sourceOpts), view, opts)
  }

  addFeed (feed) {
    if (!feed.opened) return feed.ready(() => this.addFeed(feed))
    const hkey = feed.key.toString('hex')
    if (this._feeds.has(hkey)) return
    this._feeds.set(hkey, feed)
    this._indexer.addReady(feed, { scan: true })
    this.emit('feed', feed)
  }

  feed (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    return this._feeds.get(key)
  }

  feeds () {
    return Array.from(this._feeds.values())
  }

  get view () {
    return this._kappa.view
  }

  get api () {
    return this._kappa.api
  }

  status () {
    return this._kappa.getState()
  }

  _getFromFeed (key, seq, opts = {}, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    const feed = this.feed(key)
    if (!feed) return cb(new Error('Feed does not exist: ' + key))
    feed.get(seq, opts, (err, value) => {
      if (err) return cb(err)
      const message = {
        key: feed.key.toString('hex'),
        seq: Number(seq),
        value
      }
      if (this._onget) this._onget(message, opts, cb)
      else cb(null, message)
    })
  }

  getBlock (req, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    cb = maybeCallback(cb)
    const self = this
    this._resolveRequest(req, (err, req) => {
      if (err) return cb(err)
      // TODO: Keep this?
      if (req.seq === 0) return cb(new Error('seq 0 is the header, not a record'))

      // TODO: Re-enable cache.
      // if (this._recordCache.has(req.lseq)) {
      //   return cb(null, this._recordCache.get(req.lseq))
      // }

      this._getFromFeed(req.key, req.seq, opts, finish)

      function finish (err, message) {
        if (err) return cb(err)
        message.lseq = req.lseq
        message.meta = req.meta
        // message.version = message.key + '@' + message.seq
        // self._recordCache.set(req.lseq, message)
        // if (req.meta) {
        //   message = { ...message, meta: req.meta }
        // }
        cb(null, message)
      }
    })
    return cb.promise
  }

  _resolveRequest (req, cb) {
    if (!empty(req.lseq) && empty(req.seq)) {
      this._indexer.lseqToKeyseq(req.lseq, (err, keyseq) => {
        if (!err && keyseq) {
          req.key = keyseq.key
          req.seq = keyseq.seq
        }
        finish(req)
      })
    } else if (empty(req.lseq)) {
      this._indexer.keyseqToLseq(req.key, req.seq, (err, lseq) => {
        if (!err && lseq) req.lseq = lseq
        finish(req)
      })
    } else finish(req)

    function finish (req) {
      if (empty(req.key) || empty(req.seq)) return cb(new Error('Invalid get request'))
      req.seq = parseInt(req.seq)
      if (!empty(req.lseq)) req.lseq = parseInt(req.lseq)
      if (Buffer.isBuffer(req.key)) req.key = req.key.toString('hex')
      cb(null, req)
    }
  }

  createGetStream (opts = {}) {
    const self = this

    const { cacheid } = opts

    let bitfield
    if (cacheid) {
      if (!this._queryBitfields.has(cacheid)) {
        this._queryBitfields.set(cacheid, Bitfield())
      }
      bitfield = this._queryBitfields.get(cacheid)
    }

    const transform = through(function (req, next) {
      self._resolveRequest(req, (err, req) => {
        if (err) return next()
        if (bitfield && bitfield.get(req.lseq)) {
          this.push({ lseq: req.lseq, meta: req.meta })
          return next()
        }
        self.getBlock(req, (err, message) => {
          if (err) return this.destroy(err)
          if (bitfield) bitfield.set(req.lseq, 1)
          this.push(message)
          next()
        })
      })
    })
    return transform
  }

  sync (views, cb) {
    if (typeof views === 'function') {
      cb = views
      views = null
    }
    // cb = maybeCallback(cb)
    // console.log('sync in', new Error().stack)
    process.nextTick(() => {
      this._kappa.ready(views, () => {
        // console.log('sync out')
        cb()
      })
    })
    // return cb.promise
  }

}

function empty (value) {
  return value === undefined || value === null
}

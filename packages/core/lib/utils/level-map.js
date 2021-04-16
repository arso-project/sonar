const codecs = require('codecs')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise')
const mutex = require('mutexify')
const { maybeCallback } = require('../util')

const SEPERATOR = '!'
const END = '\uffff'

module.exports = class LevelMap extends Nanoresource {
  constructor (db, opts = {}) {
    super()
    this.db = db
    this._data = new Map()
    this._data = {}
    this._queue = {}
    this._valueEncoding = codecs(opts.valueEncoding || 'json')
    this._condition = opts.condition
    this._lock = opts.lock || mutex()
    this._prefix = opts.prefix || '_'
    this._onerror = opts.onerror || (err => { throw err })
  }

  prefix (prefix, opts = {}) {
    if (this._prefix) prefix = this._prefix + SEPERATOR + prefix
    opts.prefix = prefix
    if (!opts.onerror) opts.onerror = this._onerror
    return new this.constructor(this.db, opts)
  }

  _open (cb) {
    cb = maybeCallback()
    const opts = {}
    if (this._prefix) {
      opts.gt = this._prefix + SEPERATOR
      opts.lt = this._prefix + SEPERATOR + END
    }
    const newData = this._data
    this._data = {}
    const rs = this.db.createReadStream(opts)
    rs.on('data', ({ key, value }) => {
      if (this._prefix) key = key.substring(this._prefix.length + 1)
      this._data[key] = this._valueEncoding.decode(value)
    })
    rs.on('end', () => {
      this._data = { ...this._data, ...newData }
      cb()
    })
    return cb.promise
  }

  _close (cb) {
    cb = maybeCallback(cb)
    this._closing = true
    this.flush(cb)
    return cb.promise
  }

  entries () {
    return Object.entries(this._data)
  }

  values () {
    const values = Object.values(this._data)
    return values
  }

  get (key) {
    return this._data[key]
  }

  find (fn) {
    let values = Array.from(Object.values(this._data))
    if (!values.length) return null
    values = values.filter(fn)
    if (!values.length) return null
    return values[0]
  }

  has (key) {
    return this._data[key] !== undefined
  }

  set (key, value, flush = true) {
    this._data[key] = value
    this._queue[key] = { value, type: 'put' }
    if (flush) this._queueFlush()
  }

  setFlush (key, value, cb) {
    cb = maybeCallback(cb)
    this.set(key, value)
    this.flush(() => {
      cb()
    })
    return cb.promise
  }

  update (key, fn) {
    if (!this.opened) throw new Error('Not opened')
    const value = this.get(key)
    const nextValue = fn(value)
    this.set(key, nextValue)
  }

  updateFlush (key, fn, cb) {
    cb = maybeCallback(cb)
    if (!this.opened) {
      this.open(() => this.updateFlush(key, fn, cb))
      return cb.promise
    }
    this.update(key, fn)
    this.flush(cb)
  }

  batch (data, flush = true) {
    Object.entries(data).map(([key, value]) => {
      this.set(key, value, { flush: false })
    })
    if (flush) this._queueFlush()
  }

  batchFlush (data, cb) {
    cb = maybeCallback(cb)
    this.batch(data)
    this.flush(cb)
    return cb.promise
  }

  delete (key, flush = true) {
    this._data[key] = undefined
    this._queue[key] = { type: 'del' }
    if (flush) this._queueFlush()
  }

  deleteFlush (key, cb) {
    cb = maybeCallback(cb)
    this.delete(key)
    this.flush(cb)
    return cb.promise
  }

  _queueFlush (opts, cb) {
    if (this._flushQueued) return
    this._flushQueued = true
    process.nextTick(() => {
      if (this._closing) return
      this._flushQueued = false
      this.flush()
    })
  }

  flush (cb) {
    cb = maybeCallback(cb)
    let stack = new Error().stack
    this._lock(release => {
      const doFlush = () => {
        if (!Object.keys(this._queue).length) return release(cb)
        const queue = Object.entries(this._queue).map(([key, { value, type }]) => {
          if (this._prefix) key = this._prefix + SEPERATOR + key
          if (value) value = this._valueEncoding.encode(value)
          return { key, value, type }
        })
        this._queue = {}
        this.db.batch(queue, release.bind(null, cb))
      }
      if (this.opened) doFlush()
      else this.open(() => doFlush())
    })
    return cb.promise
  }
}

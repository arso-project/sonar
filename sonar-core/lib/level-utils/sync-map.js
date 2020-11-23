const codecs = require('codecs')
const Nanoresource = require('nanoresource')
const mutex = require('mutexify')

const CALLBACK_METHODS = [
  'open',
  'close',
  'flush',
  'getFlush',
  'setFlush',
  'deleteFlush',
  'batchFlush'
]

module.exports = class SyncMap extends Nanoresource {
  constructor (db, opts = {}) {
    super()
    this.db = db
    this._data = {}
    this._queue = {}
    this._valueEncoding = codecs(opts.valueEncoding || 'utf8')
    this._condition = opts.condition
    this._lock = mutex()

    this.promise = createPromiseProxy(this, CALLBACK_METHODS)
  }

  _open (cb) {
    const rs = this.db.createReadStream()
    rs.on('data', ({ key, value }) => {
      this._data[key] = this._valueEncoding.decode(value)
    })
    rs.on('end', () => {
      this.opened = true
      cb()
    })
  }

  _close (cb) {
    this.flush(cb)
  }

  entries () {
    return Object.entries(this._data)
  }

  values () {
    return Object.values(this._data)
  }

  get (key) {
    return this._data[key]
  }

  find (fn) {
    return Object.values(this._data).filter(fn)
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
    this.set(key, value)
    this.flush(cb)
  }

  batch (data, flush = true) {
    Object.entries(data).map(([key, value]) => {
      this.set(key, value, { flush: false })
    })
    if (flush) this._queueFlush()
  }

  batchFlush (data, cb) {
    this.batch(data)
    this.flush(cb)
  }

  delete (key, cb, flush = true) {
    this._data[key] = undefined
    this._queue[key] = { type: 'del' }
    if (flush) this._queueFlush()
  }

  deleteFlush (key, cb) {
    this.delete(key)
    this.flush(cb)
  }

  _queueFlush (opts, cb) {
    if (this._flushQueued) return
    this._flushQueued = true
    process.nextTick(() => {
      this._flushQueued = false
      this.flush()
    })
  }

  flush (cb = noop) {
    this._lock(release => {
      if (!Object.keys(this._queue).length) return release(cb)
      const queue = Object.entries(this._queue).map(([key, { value, type }]) => {
        if (value) value = this._valueEncoding.encode(value)
        return { key, value, type }
      })
      this.queue = {}
      this.db.batch(queue, release.bind(null, cb))
    })
  }
}

function noop () {}

const kCache = Symbol('promise-cache')
function createPromiseProxy (instance, callbackMethods) {
  if (!instance[kCache]) instance[kCache] = {}
  const cache = instance[kCache]
  return new Proxy(instance, {
    get (target, propKey) {
      const value = Reflect.get(target, propKey)
      if (typeof value !== 'function') return value
      if (!cache[propKey]) {
        cache[propKey] = promisify(target, propKey, value)
      }
      return cache[propKey]
    }
  })

  function promisify (target, propKey, func) {
    if (!callbackMethods.includes(propKey)) {
      return function (...args) {
        Reflect.apply(func, target, args)
      }
    }
    return function (...args) {
      // Support callbacks if last arg is a function.
      if (typeof args[args.length - 1] === 'function') {
        return Reflect.apply(func, target, args)
      }

      // Otherwise, return a promise.
      return new Promise((resolve, reject) => {
        args.push((err, ...result) => {
          if (err) return reject(err)
          if (result.length > 1) resolve(result)
          else resolve(result[0])
        })
        Reflect.apply(func, target, args)
      })
    }
  }
}

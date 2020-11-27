const codecs = require('codecs')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const mutex = require('mutexify')
const { maybeCallback } = require('../util')

module.exports = class SyncMap extends Nanoresource {
  constructor (db, opts = {}) {
    super()
    this.db = db
    this._data = {}
    this._queue = {}
    this._valueEncoding = codecs(opts.valueEncoding || 'json')
    this._condition = opts.condition
    this._lock = mutex()

    this._onerror = err => err && this.emit('error', err)
  }

  _open () {
    const cb = maybeCallback()
    const rs = this.db.createReadStream()
    rs.on('data', ({ key, value }) => {
      this._data[key] = this._valueEncoding.decode(value)
    })
    rs.on('end', () => {
      cb()
    })
    return cb.promise
  }

  _close (cb) {
    cb = maybeCallback(cb)
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
    cb = maybeCallback(cb)
    this.set(key, value)
    this.flush(cb)
    return cb.promise
  }

  update (key, fn) {
    const value = this.get(key)
    const nextValue = fn(value)
    this.set(key, nextValue)
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
      this._flushQueued = false
      this.flush()
    })
  }

  flush (cb) {
    cb = maybeCallback(cb)
    this._lock(release => {
      if (!Object.keys(this._queue).length) return release(cb)
      const queue = Object.entries(this._queue).map(([key, { value, type }]) => {
        if (value) value = this._valueEncoding.encode(value)
        return { key, value, type }
      })
      this.queue = {}
      this.db.batch(queue, release.bind(null, cb))
    })
    return cb.promise
  }
}

function noop () {}

// const kCache = Symbol('promise-cache')
// function createPromiseProxy (instance, callbackMethods) {
//   if (!instance[kCache]) instance[kCache] = {}
//   const cache = instance[kCache]
//   return new Proxy(instance, {
//     get (target, propKey) {
//       const value = Reflect.get(target, propKey)
//       if (typeof value !== 'function') return value
//       if (!cache[propKey]) {
//         cache[propKey] = promisify(target, propKey, value)
//       }
//       return cache[propKey]
//     }
//   })

//   function promisify (target, propKey, func) {
//     if (!callbackMethods.includes(propKey)) {
//       return function (...args) {
//         Reflect.apply(func, target, args)
//       }
//     }
//     return function (...args) {
//       // Support callbacks if last arg is a function.
//       if (typeof args[args.length - 1] === 'function') {
//         return Reflect.apply(func, target, args)
//       }

//       // Otherwise, return a promise.
//       return new Promise((resolve, reject) => {
//         args.push((err, ...result) => {
//           if (err) return reject(err)
//           if (result.length > 1) resolve(result)
//           else resolve(result[0])
//         })
//         Reflect.apply(func, target, args)
//       })
//     }
//   }
// }

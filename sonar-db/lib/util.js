const crypto = require('crypto')
const base32 = require('base32')
const { Writable, Transform } = require('stream')

exports.keyseq = function (record) {
  return record.key + '@' + record.seq
}

exports.uuid = function () {
  return base32.encode(crypto.randomBytes(16))
}

exports.through = function (transform) {
  return new Transform({
    objectMode: true,
    transform
  })
}

exports.sink = function (fn) {
  return new Writable({
    objectMode: true,
    write (msg, enc, next) {
      fn(msg, next)
    }
  })
}

exports.once = function (fn) {
  let called = false
  return (...args) => {
    if (!called) fn(...args)
    called = true
  }
}

exports.defaultTrue = function (val) {
  if (typeof val === 'undefined') return true
  return !!val
}

exports.noop = function () {}

const kCache = Symbol('promise-cache')
module.exports.createPromiseProxy = function (instance, callbackMethods) {
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

const base32 = require('base32')
const hcrypto = require('hypercore-crypto')
const DatEncoding = require('dat-encoding')
const { randomBytes, createHash } = require('crypto')
const { Writable, Transform } = require('streamx')

const fs = require('fs')
const p = require('path')
const os = require('os')
const yaml = require('js-yaml')

const ID_NAMESPACE = Buffer.from('sonar-id')

exports.discoveryKey = hcrypto.discoveryKey

exports.loadTypesFromDir = function (paths) {
  if (!Array.isArray(paths)) paths = [paths]
  const yamlPaths = []
  for (const path of paths) {
    const list = fs.readdirSync(path)
    for (const filename of list) {
      if (filename.endsWith('.yml')) yamlPaths.push(p.join(path, filename))
    }
  }

  const yamls = []
  for (const path of yamlPaths) {
    const buf = fs.readFileSync(path)
    const parsed = yaml.safeLoad(buf)
    yamls.push(parsed)
  }
  return yamls
}

exports.keyseq = function (record) {
  return record.key + '@' + record.seq
}

exports.uuid = function () {
  return base32.encode(randomBytes(16))
}

exports.deriveId = function (value, opts = {}) {
  let { encoding = 'utf8', namespace = ID_NAMESPACE } = opts
  if (!Buffer.isBuffer(namespace)) namespace = Buffer.from(namespace, 'utf8')
  if (!Buffer.isBuffer(value)) value = Buffer.from(value, encoding)
  value = Buffer.concat([namespace, value])
  const hash = createHash('sha256').update(value).digest()
  return base32.encode(hash.slice(0, 16))
}

exports.through = function (transform) {
  return new Transform({
    transform
  })
}

exports.sink = function (write) {
  return new Writable({
    write
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

exports.maybeCallback = function (callback) {
  if (typeof callback === 'function' && callback.promise) callback.promise = undefined
  if (callback) return callback
  let _resolve, _reject
  callback = function (err, result) {
    if (err) _reject(err)
    else _resolve(result)
  }
  callback.promise = new Promise((resolve, reject) => {
    _resolve = resolve
    _reject = reject
  })
  return callback
}

exports.promiseToCallback = function (callback, promise) {
  promise.then(
    result => callback(null, result),
    err => callback(err)
  )
}

exports.clock = function clock () {
  const [ss, sn] = process.hrtime()
  return () => {
    const [ds, dn] = process.hrtime([ss, sn])
    const ns = (ds * 1e9) + dn
    const ms = round(ns / 1e6)
    const s = round(ms / 1e3)
    if (s >= 1) return s + 's'
    if (ms >= 0.01) return ms + 'ms'
    if (ns) return ns + 'ns'
  }
}

// Taken from hyper-sdk/sdk.js line 242
exports.resolveKeyOrName = function resolveKeyOrName (nameOrKey) {
  let key, name, id
  try {
    key = DatEncoding.decode(nameOrKey)
    id = key.toString('hex')
    // Normalize keys to be hex strings of the key instead of dat URLs
  } catch (e) {
    // Probably isn't a `dat://` URL, so it must be a name
    name = nameOrKey
    id = name
  }
  return { key, name, id }
}

exports.defaultStoragePath = function defaultStoragePath (opts) {
  const os = require('os')
  return p.join(os.homedir(), '.sonar')
}

function round (num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

const crypto = require('crypto')
const base32 = require('base32')
const { Writable, Transform } = require('streamx')

const fs = require('fs')
const p = require('path')
const yaml = require('js-yaml')

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
  return base32.encode(crypto.randomBytes(16))
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

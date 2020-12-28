const tmp = require('temporary-directory')
const { CollectionStore } = require('../..')

module.exports = function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = maybepify(cb)
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const collections = new CollectionStore(dir, opts)
    collections.ready(err => {
      if (err) return cb(err)
      cb(null, collections, cleanup)
    })
    function cleanup (cb) {
      cb = maybepify(cb)
      collections.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
      return cb.promise
    }
  }
  return cb.promise
}

function maybepify (cb) {
  if (!cb) {
    let pargs
    const callback = (err, ...res) => {
      if (err) return pargs.reject(err)
      if (res.length === 1) pargs.resolve(res[0])
      else pargs.resolve(res)
    }
    const promise = new Promise((resolve, reject) => {
      pargs = { resolve, reject }
    })
    callback.promise = promise
    return callback
  } else {
    cb.promise = undefined
    return cb
  }
}

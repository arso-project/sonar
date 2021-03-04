const pump = require('pump')
exports.runAll = function runAll (ops, cb) {
  const promise = new Promise((resolve, reject) => {
    runNext(ops.shift())
    function runNext (op) {
      op(err => {
        if (err) {
          console.error(err)
          return reject(err)
        }
        const next = ops.shift()
        if (!next) return resolve()
        return runNext(next)
      })
    }
  })
  if (cb) promise.then(cb).catch(cb)
  else return promise
}

exports.replicate = async function replicate (a, b, opts) {
  if (typeof opts === 'function') return replicate(a, b, null, opts)
  if (!opts) opts = { live: true }
  const stream = a.replicate(true, opts)
  pump(stream, b.replicate(false, opts), stream, err => {
    // console.log('replication closed', err)
  })
}

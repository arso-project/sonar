const tmp = require('temporary-directory')
const { IslandStore } = require('../..')

module.exports = function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const islands = new IslandStore(dir, opts)
    islands.ready(err => {
      if (err) return cb(err)
      cb(null, islands, cleanup)
    })
    function cleanup (cb) {
      islands.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
    }
  }
}

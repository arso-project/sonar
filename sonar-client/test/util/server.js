const createServer = require('@arso-project/sonar-server')
const tmp = require('temporary-directory')

module.exports = {
  makeServer
}

function makeServer (opts = {}) {
  return new Promise((resolve, reject) => {
    tmp((err, dir, cleanup) => {
      if (err) return reject(err)

      opts.storage = dir
      opts.port = opts.port || 21212
      opts.logger = false

      const server = createServer(opts)
      server.listen(opts.port)
      const shutdown = () => new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) console.error('Error closing server.')
          cleanup(err => {
            if (err) reject(err)
            else resolve()
          })
        })
      })
      resolve(shutdown)
    })
  })
}

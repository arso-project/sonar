const createServer = require('@arso-project/sonar-server')
const tmp = require('temporary-directory')
const SonarClient = require('../..')

module.exports = {
  makeServer, makeClient
}

async function makeClient (opts = {}) {
  let _cleanup = await makeServer(opts)
  let client = new SonarClient(`http://localhost:${opts.port}/api`, opts.island)
  return [client, cleanup]
  function cleanup () {
    // client.close()
    return _cleanup()
  }
}

function makeServer (opts = {}) {
  return new Promise((resolve, reject) => {
    tmp((err, dir, cleanup) => {
      if (err) return reject(err)

      opts.storage = dir
      opts.port = opts.port || 21212
      // opts.logger = false

      const server = createServer(opts)
      server.listen(opts.port, (err) => {
        if (err) reject(err)
        resolve(shutdown)

        function shutdown () {
          return new Promise((resolve, reject) => {
            server.close((err) => {
              if (err) console.error('Error closing server.')
              cleanup(err => {
                if (err) reject(err)
                else resolve()
              })
            })
          })
        }
      })
    })
  })
}

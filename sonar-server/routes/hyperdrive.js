const hyperdriveHttp = require('hyperdrive-http')
const p = require('path')

module.exports = { hyperdriveHandler, hyperdriveRoutes }

function hyperdriveRoutes (fastify, opts, done) {
  const islands = opts.islands

  fastify.get('/:key/*', (req, res) => {
    const { key, '*': wildcard } = req.params
    hyperdriveHandler(islands, key, wildcard, req, res)
  })

  done()
}

function hyperdriveHandler (islands, name, path, req, res) {
  islands.get(name, (err, island) => {
    if (err) return res.code(404).send('Not found')
    // TODO: Clearer API method in hyper-content-db
    // to get a drive instance.
    island.writer((err, drive) => {
      if (err) return res.code(404).send('Not found')

      // If Content-Type: application/json was requested,
      // return stat/readdir info in JSON.
      if (req.headers['content-type'] === 'application/json') {
        fastifyHyperdriveHttpJson(drive, path, req, res)
      // Otherwise, serve files.
      } else {
        const handler = hyperdriveHttp(drive)
        // "Downgrade" from fastify to node core http req/res objects
        const rawReq = req.req
        rawReq.url = path
        handler(rawReq, res.res)
      }
    })
  })
}

function fastifyHyperdriveHttpJson (drive, path, req, res) {
  drive.stat(path, (err, stat) => {
    if (err) return onerror(res, 404, err)
    if (stat.isDirectory()) {
      ondirectory(path, send)
    } else {
      send(null, stat)
    }
  })

  function ondirectory (path, cb) {
    let pending
    const results = []
    drive.readdir(path, (err, list) => {
      if (err || !list.length) return cb(err, results)
      pending = list.length
      list.forEach(path => stat(path))
    })

    function stat (name) {
      const fullpath = p.join(path, name)
      drive.stat(fullpath, (err, stat) => {
        // TODO: Handle errors?
        if (!err && stat) {
          stat.path = fullpath
          stat.name = name
          stat.directory = stat.isDirectory()
          // Safeguard: Convert Stat to regular object.
          // TODO: Possibly filter out some keys.
          stat = { ...stat }
          results.push(stat)
        }
        if (--pending === 0) cb(null, results)
      })
    }
  }

  function send (err, data) {
    if (err) return onerror(res, 500, err)
    res.send(data)
  }

  function onerror (res, status, err) {
    res.code(status)
    let error = null
    if (err instanceof Error) {
      error = err.message
    } else if (typeof err === 'string') {
      error = err
    }
    send(null, { error })
  }
}

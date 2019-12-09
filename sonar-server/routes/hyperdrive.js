const hyperdriveHttp = require('hyperdrive-http')
const p = require('path')
const mkdirp = require('mkdirp')
const { Transform } = require('stream')
const pretty = require('pretty-bytes')
const speedometer = require('speedometer')

module.exports = { hyperdriveHandler }

function hyperdriveHandler (islands, name, path, req, res) {
  islands.get(name, (err, island) => {
    if (err) return res.status(404).send('Not found')
    // TODO: Clearer API method in hyper-content-db
    // to get a drive instance.
    island.writer((err, drive) => {
      if (err) return res.status(404).send('Not found')
      ondrive(drive, path, req, res)
    })
  })
}

function ondrive (drive, path, req, res) {
  const method = req.method
  if (method === 'PUT') {
    onput(drive, path, req, res)
  } else if (method === 'GET') {
    // If Content-Type: application/json was requested,
    // return stat/readdir info in JSON.
    if (req.headers['content-type'] === 'application/json') {
      ongetjson(drive, path, req, res)
    // Otherwise, serve files.
    } else {
      ongetfile(drive, path, req, res)
    }
  } else {
    onerror(res, 'Invalid method', 405)
  }
}

function ongetfile (drive, path, req, res) {
  const handler = hyperdriveHttp(drive)
  req.url = path
  handler(req, res)
}

function ongetjson (drive, path, req, res) {
  drive.stat(path, (err, stat) => {
    if (err) return onerror(res, err, 404)
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
    if (err) return onerror(res, err, 500)
    else {
      res.send(data)
    }
  }
}

function onerror (res, msg, code) {
  code = code || 500
  if (msg instanceof Error) msg = msg.message
  msg = String(msg)
  res.status(code).send({ error: msg })
  // res.statusCode = code
  // res.setHeader('Content-Type', 'application/json')
  // res.end(JSON.stringify({ error: msg }))
}

function onput (drive, path, req, res) {
  if (!drive.writable) return onerror(res, 'Drive is not writable', 403)
  mkdirp(p.dirname(path), { fs: drive }, err => {
    if (err && err.code !== 'EEXISTS') return onerror(res, 'Cannot create directory', 500)
    const ws = drive.createWriteStream(path)
    req.pipe(transform()).pipe(ws).on('finish', () => {
      res.statusCode = 200
      res.send('ok')
    })
  })

  function transform () {
    const speedo = speedometer()
    let total = 0
    let speed
    let interval = setInterval(() => {
      if (speed) console.log(`${pretty(speed)}/s`)
    }, 1000)
    return new Transform({
      transform (chunk, enc, next) {
        total += chunk.length
        speed = speedo(chunk.length)
        this.push(chunk)
        next()
      },
      flush (cb) {
        console.log(`total: ${pretty(total)}`)
        clearInterval(interval)
        cb()
      }
    })
  }
}

// function hyperdriveRoutes (fastify, opts, done) {
//   const islands = opts.islands

//   fastify.get('/:key/*', (req, res) => {
//     const { key, '*': wildcard } = req.params
//     hyperdriveHandler(islands, key, wildcard, req, res)
//   })

//   done()
// }


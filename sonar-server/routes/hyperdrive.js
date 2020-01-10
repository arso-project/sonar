const hyperdriveHttp = require('hyperdrive-http')
const p = require('path')
// const mkdirp = require('mkdirp')
const { Transform } = require('stream')
const pretty = require('pretty-bytes')
const express = require('express')
const speedometer = require('speedometer')
const debug = require('debug')('sonar-server:fs')

module.exports = function hyperdriveMiddleware (islands) {
  const router = express.Router()

  router.use('/:drive', function (req, res, next) {
    req.island.drive(req.params.drive, (err, drive) => {
      if (err) return next(err)
      req.drive = drive
      next()
    })
  })
  router.get('/:drive/*', onget)
  router.put('/:drive/*', onput)
  router.get('/:drive', onget)

  return router
}

function onget (req, res, next) {
  const path = req.params['0'] || '/'
  if (req.headers['content-type'] === 'application/json') {
    ongetjson(req.drive, path, req, res, next)
  // Otherwise, serve files.
  } else {
    ongetfile(req.drive, path, req, res, next)
  }
}

function ongetfile (drive, path, req, res, next) {
  const handler = hyperdriveHttp(drive)
  req.url = path
  handler(req, res)
}

function ongetjson (drive, path, req, res, next) {
  drive.stat(path, (err, stat) => {
    if (err) return next(err)
    if (stat.isDirectory()) {
      ondirectory(path)
    } else {
      stat = cleanStat(stat, { path: p.dirname(path), name: p.basename(path) })
      res.send(stat)
    }
  })

  function ondirectory (path) {
    let pending
    const results = []
    drive.readdir(path, (err, list) => {
      if (err) return next(err)
      if (!list.length) return res.send([])
      pending = list.length
      list.forEach(path => stat(path))
    })

    function stat (name) {
      const fullpath = p.join(path, name)
      drive.stat(fullpath, (err, stat) => {
        // TODO: Handle errors?
        if (!err && stat) {
          stat = cleanStat(stat, { path: fullpath, name })
          results.push(stat)
        }
        if (--pending === 0) res.send(results)
      })
    }
  }
}

function cleanStat (stat, opts = {}) {
  const { path, name } = opts
  // Safeguard: Convert Stat to regular object.
  // TODO: Possibly filter out some keys.
  // TODO: Here we assume all metadata entries are strings.
  // TODO: Filter metadata.
  const metadata = {}
  for (const [key, value] of Object.entries(stat.metadata)) {
    metadata[key] = value.toString()
  }
  return {
    ...stat,
    path,
    name,
    directory: stat.isDirectory(),
    metadata

  }
  return stat
}

function onput (req, res, next) {
  const drive = req.drive
  const path = req.params['0']
  const opts = {}

  if (req.query.metadata) {
    try {
      opts.metadata = JSON.parse(req.query.metadata)
    } catch (err) {
      return next(new Error('invalid metadata JSON'))
    }
  }

  if (!path) return next(new StatusError('path is required', 404))
  if (!drive.writable) return next(new StatusError('drive is not writable', 403))

  debug('put', path)
  mkdirp(drive, p.dirname(path), err => {
    if (err && err.code !== 'EEXIST') return next(err)
    const ws = drive.createWriteStream(path, opts)
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
      if (speed) debug(`${pretty(speed)}/s`)
    }, 1000)
    return new Transform({
      transform (chunk, enc, next) {
        total += chunk.length
        speed = speedo(chunk.length)
        this.push(chunk)
        next()
      },
      flush (cb) {
        debug(`total: ${pretty(total)}`)
        clearInterval(interval)
        cb()
      }
    })
  }
}

function StatusError (msg, code) {
  const error = Error(msg)
  error.statusCode = code
  return error
}

function mkdirp (fs, path, cb) {
  const parts = path.split('/').filter(x => x)
  const cur = []
  next()
  function next () {
    cur.push(parts.shift())
    fs.mkdir(cur.join('/'), done)
  }
  function done (err) {
    if (err && err.code !== 'EEXISTS') return cb(err)
    if (!parts.length) return cb()
    else process.nextTick(next)
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


const { IslandStore } = require('@arso-project/sonar-dat')
const bodyParser = require('body-parser')
const onexit = require('async-exit-hook')
const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const debug = require('debug')('sonar-server')
const p = require('path')
const os = require('os')
// const websocketStream = require('websocket-stream/stream')

const DEFAULT_STORAGE = p.join(os.homedir(), '.sonar')
const DEFAULT_PORT = 9191
const DEFAULT_HOST = 'localhost'

module.exports = function SonarServer (opts) {
  const config = {
    storage: opts.storage || DEFAULT_STORAGE,
    port: opts.port || DEFAULT_PORT,
    host: opts.host || DEFAULT_HOST
  }

  const api = {
    config,
    islands: new IslandStore(config.storage)
  }

  const app = express()
  expressWebSocket(app)

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json({
    // Currently, the _search route accepts json encoded strings.
    // Remove once that changes.
    strict: false
  }))

  // CORS headers
  app.use(cors({
    origin: '*'
  }))
  // app.use(function (req, res, next) {
  //   res.header('Access-Control-Allow-Origin', '*')
  //   res.header('Access-Control-Allow-Credentials', true)
  //   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  //   next()
  // })
  app.use(function configMiddleware (req, res, next) {
    req.config = api.config
    next()
  })
  app.use(function groupMiddleware (req, res, next) {
    req.islands = api.groups
    next()
  })

  app.use('/api', require('./routes/api')(api))

  // Error handling
  app.use(function (err, req, res, next) {
    debug(err)
    const result = {
      error: err.message
    }
    if (!err.statusCode) err.statusCode = 500
    res.status(err.statusCode).json(result)
  })

  app.start = function (opts, cb) {
    if (typeof opts === 'function') return app.start(null, opts)
    opts = opts || {}
    app._port = opts.port || config.port
    app._host = opts.host || config.host
    app.server = app.listen(app._port, app._host, cb)
  }

  app.close = function (cb = noop) {
    app.server.close(() => {
      api.islands.close(cb)
    })
  }

  onexit((cb) => {
    api.islands.close((err) => {
      if (err) debug('Error closing island store', err)
      app.close(cb)
    })
  })

  return app
}

function noop () {}

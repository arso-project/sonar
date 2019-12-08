const { IslandStore } = require('@arso-project/sonar-dat')
const bodyParser = require('body-parser')
const onexit = require('async-exit-hook')
const express = require('express')
const expressWebSocket = require('express-ws')
// const websocketStream = require('websocket-stream/stream')

module.exports = function SonarServer (opts) {
  const config = {
    storage: opts.storage,
    port: opts.port || 9191
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
  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Credentials', true)
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
  })
  app.use(function configMiddleware (req, res, next) {
    req.config = api.config
    next()
  })
  app.use(function groupMiddleware (req, res, next) {
    req.islands = api.groups
    next()
  })

  app.use('/api', require('./routes/api')(api))

  app.start = function (opts, cb) {
    if (typeof opts === 'function') return app.start(null, opts)
    opts = opts || {}
    app.server = app.listen(opts.port || config.port, opts.host || config.host, cb)
  }

  app.close = function (cb = noop) {
    app.server.close(() => {
      api.islands.close(cb)
    })
  }

  onexit((cb) => {
    app.close(cb)
  })

  return app
}

function noop () {}

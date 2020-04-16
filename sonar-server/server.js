const { IslandStore } = require('@arso-project/sonar-core')
const bodyParser = require('body-parser')
const onexit = require('async-exit-hook')
const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const shutdown = require('http-shutdown')
const debug = require('debug')('sonar-server')
const p = require('path')
const os = require('os')
const swaggerUi = require('swagger-ui-express')
const thunky = require('thunky')
// const websocketStream = require('websocket-stream/stream')

const apiRouter = require('./routes/api')
const apiDocs = require('./docs/swagger.json')

const DEFAULT_STORAGE = p.join(os.homedir(), '.sonar')
const DEFAULT_PORT = 9191
const DEFAULT_HOSTNAME = 'localhost'

module.exports = function SonarServer (opts) {
  opts = {
    storage: DEFAULT_STORAGE,
    port: DEFAULT_PORT,
    hostname: DEFAULT_HOSTNAME,
    dev: process.env.NODE_ENV === 'development',
    ...opts
  }

  const storeOpts = {
    network: opts.network === undefined ? true : opts.network
  }

  const api = {
    islands: new IslandStore(opts.storage, storeOpts)
  }

  const app = express()

  // Make the sonar api available on the app object.
  app.api = api

  // Enable websockets
  expressWebSocket(app)

  // Bodyparser
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

  // Include the static UI at /
  const uiStaticPath = p.join(p.dirname(require.resolve('@arso-project/sonar-ui/package.json')), 'build', 'dist')
  app.use(express.static(uiStaticPath))

  // If in dev mode, serve the webpack dev middleware for the UI at /ui-dev
  if (opts.dev) {
    const devMiddleware = require('@arso-project/sonar-ui/express-dev')
    devMiddleware(app, { publicPath: '/ui-dev', workdir: opts.workdir })
  }

  // Make the island api available to all requests
  app.use(function islandMiddleware (req, res, next) {
    req.islands = api.islands
    next()
  })

  // Main API
  const apiRoutes = apiRouter(api)

  // Serve the API at /api
  app.use('/api', apiRoutes)
  // TODO: Change to v1
  // app.use('/api/v1', apiRoutes)

  // Serve the swagger API docs at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(
    apiDocs,
    {
      customCss: '.swagger-ui .topbar { display: none }'
    }
  ))

  // Error handling
  app.use(function (err, req, res, next) {
    debug('request produced error', err)
    const result = {
      error: err.message
    }
    if (!err.statusCode) err.statusCode = 500
    res.status(err.statusCode).send(result)
  })

  app.start = thunky((cb = noop) => {
    if (typeof opts === 'function') return app.start(null, opts)
    // Open the island store.
    api.islands.ready(err => {
      if (err) return cb(err)
      app.port = opts.port
      app.hostname = opts.hostname
      // Start the HTTP server.
      app.server = app.listen(app.port, app.hostname, cb)
      // Mount the shutdown handler onto the server.
      shutdown(app.server)
    })
  })

  app.close = thunky((cb = noop) => {
    let pending = 2
    app.server.forceShutdown(err => {
      debug('closed: server', err || '')
      finish()
    })
    api.islands.close(finish)
    function finish () {
      if (--pending === 0) cb()
    }
  })

  // Ensure everything gets closed when the node process exits.
  onexit((cb) => {
    app.close(() => {
      cb()
    })
  })

  return app
}

function noop () {}

const { CollectionStore } = require('@arso-project/sonar-core')
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

const { storagePath } = require('@arso-project/sonar-common/storage.js')
const apiRouter = require('./routes/api')
const apiDocs = require('./docs/swagger.json')
const Auth = require('./lib/auth')

const DEFAULT_PORT = 9191
const DEFAULT_HOSTNAME = 'localhost'

module.exports = function SonarServer (opts = {}) {
  console.log('createServer opts', {})
  opts.storage = storagePath(opts.storage)
  if (!opts.port) opts.port = DEFAULT_PORT
  if (!opts.hostname) opts.hostname = DEFAULT_HOSTNAME
  if (!opts.dev) opts.dev = process.env.NODE_ENV === 'development'

  const storeOpts = {
    network: opts.network === undefined ? true : opts.network,
    swarm: {
      bootstrap: opts.bootstrap
    }
  }

  const auth = new Auth(opts.storage)
  // Open auth store (asynchrounsly)
  auth.open(err => {
    // TODO: How do we handle top-level errors?
    console.error(err)
  })

  const api = {
    auth,
    config: {
      ...opts
    },
    collections: new CollectionStore(opts.storage, storeOpts)
  }

  const app = express()

  // Make the sonar api available on the app object.
  app.api = api

  // Enable websockets
  expressWebSocket(app)

  // Bodyparser
  app.use(bodyParser.urlencoded({
    limit: '10MB',
    extended: true
  }))
  app.use(bodyParser.json({
    limit: '10MB',
    // Currently, the _search route accepts json encoded strings.
    // Remove once that changes.
    strict: false
  }))

  // CORS headers
  app.use(cors({
    origin: '*'
  }))

  // Make the collection api available to all requests
  app.use(function collectionMiddleware (req, res, next) {
    req.collections = api.collections
    next()
  })

  // Main API
  const apiRoutes = apiRouter(api)

  // Serve the API at /api/v1
  app.use('/api', apiRoutes)
  app.use('/api/v1', apiRoutes)

  // Serve the swagger API docs at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(
    apiDocs,
    {
      customCss: '.swagger-ui .topbar { display: none }'
    }
  ))

  // Include the client api docs at /api-docs-client
  const clientApiDocsPath = p.join(p.dirname(require.resolve('@arso-project/sonar-client/package.json')), 'apidocs')
  app.use('/api-docs-client', express.static(clientApiDocsPath))

  // If in dev mode, serve the webpack dev middleware for the UI at /ui-dev
  if (opts.dev) {
    const devMiddleware = require('@arso-project/sonar-ui/express-dev')
    devMiddleware(app, { publicPath: '/ui-dev', workdir: opts.workdir })
  }

  // Include the static UI at /
  const uiStaticPath = p.join(p.dirname(require.resolve('@arso-project/sonar-ui/package.json')), 'build', 'dist')
  app.use('/', express.static(uiStaticPath))

  // Error handling
  app.use(function (err, req, res, next) {
    debug('request produced error', err)
    const result = {
      error: err.message
    }
    res.status(err.statusCode || 500).send(result)
  })

  app.start = thunky((cb = noop) => {
    if (typeof opts === 'function') return app.start(null, opts)
    // Open the collection store.
    api.auth.open(err => {
      if (err) return cb(err)
      api.collections.ready(err => {
        if (err) return cb(err)
        app.port = opts.port
        app.hostname = opts.hostname
        // Start the HTTP server.
        app.server = app.listen(app.port, app.hostname, cb)
        // Mount the shutdown handler onto the server.
        shutdown(app.server)
      })
    })
  })

  app.close = thunky((cb = noop) => {
    let pending = 3
    debug('shutting down')
    app.server.forceShutdown(err => {
      debug('closed http server', err || '')
      finish()
    })
    api.collections.close(finish)
    api.auth.close(finish)
    function finish () {
      if (--pending !== 0) return
      debug('closed')
      cb()
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

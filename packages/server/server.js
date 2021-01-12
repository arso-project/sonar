const { LegacyWorkspace } = require('@arsonar/core')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise')
const bodyParser = require('body-parser')
const onexit = require('async-exit-hook')
const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const shutdown = require('http-shutdown')
const debug = require('debug')('sonar-server')
const p = require('path')
const pinoExpress = require('express-pino-logger')

const swaggerUi = require('swagger-ui-express')
const thunky = require('thunky')

const { storagePath } = require('@arsonar/common/storage.js')
const apiRouter = require('./routes/api')
const Auth = require('./lib/auth')

const DEFAULT_PORT = 9191
const DEFAULT_HOSTNAME = 'localhost'

module.exports = function SonarServer (opts = {}) {
  const config = {
    storage: storagePath(opts.storage),
    auth: {
      disableAuthentication: opts.disableAuthentication
    },
    server: {
      hostname: opts.hostname || DEFAULT_HOSTNAME,
      port: opts.port || DEFAULT_PORT
    },
    workspace: {
      ...(opts.workspace || {}),
      persist: opts.persist,
      network: opts.network,
      swarm: {
        bootstrap: opts.bootstrap
      }
    }
  }

  // TODO: Make dev options cleaner.
  if (opts.dev) {
    config.server.dev = { expressOas: false, uiWatch: true }
  }
  if (process.env.SONAR_OAS_GENERATE) {
    config.server.dev = config.server.dev || {}
    config.server.dev.expressOas = true
  }

  // Init authentication API.
  const auth = new Auth(config.storage, config.auth)

  // Init collection store.
  const collections = new LegacyWorkspace(config.storage, config.workspace)
  const log = collections.log

  // Init express app.
  const app = express()

  // Assemble api object.
  const api = {
    auth,
    collections,
    config,
    log
  }

  // Make the sonar api available on the app object.
  app.api = api

  if (config.auth.disableAuthentication) {
    log.warn('Authentication is disabled.')
  }

  // Logger
  const logger = pinoExpress({
    logger: collections.log,
    useLevel: 'debug',
    customSuccessMessage: res => ' ',
    customErrorMessage: err => err.message
  })
  app.use(logger)

  // If in dev mode, add a optional dev middlewares.
  let devMiddleware
  if (config.server.dev && Object.keys(config.server.dev).length) {
    devMiddleware = require('./lib/dev')
  }

  if (devMiddleware) {
    devMiddleware.initTop(app, config.server.dev)
  }

  // Enable websockets
  expressWebSocket(app)

  // Add body parsers.
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
  try {
    const apiDocs = require('./docs/swagger.json')
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(
      apiDocs,
      {
        customCss: '.swagger-ui .topbar { display: none }'
      }
    ))
  } catch (e) {}

  // Include the client api docs at /api-docs-client
  const clientApiDocsPath = p.join(
    p.dirname(require.resolve('@arsonar/client/package.json')),
    'apidocs'
  )
  app.use('/api-docs-client', express.static(clientApiDocsPath))

  // Include the static UI at /
  const uiStaticPath = p.join(
    p.dirname(require.resolve('@arsonar/ui/package.json')),
    'build',
    'dist'
  )
  app.use('/', express.static(uiStaticPath))

  // Error handling
  app.use(function (err, req, res, next) {
    const result = {
      error: err.message
    }
    res.err = err
    res.status(err.statusCode || 500).send(result)
    debug('request produced error', err, err.stack)
  })

  // Dev middleware.
  if (devMiddleware) {
    devMiddleware.initBottom(app, config.server.dev)
  }

  // Add start method.
  app.start = thunky((cb = noop) => {
    // Open the collection store.
    api.collections.ready(err => {
      if (err) return cb(err)
      api.auth.open(err => {
        if (err) return cb(err)
        app.port = config.server.port
        app.hostname = config.server.hostname
        if (app.closing) return
        // Start the HTTP server.
        const server = app.listen(config.server.port, config.server.hostname, err => {
          if (err) return cb(err)
          api.log.debug(`HTTP server listening on http://${app.hostname}:${app.port}`)
          cb()
        })
        // Mount the shutdown handler onto the server.
        app.server = shutdown(server)
        app.opened = true
      })
    })
  })

  // Add close method.
  app.close = thunky((cb = noop) => {
    app.closing = true
    let pending = 3
    debug('shutting down')
    if (app.server) {
      app.server.forceShutdown(err => {
        debug('closed http server', err || '')
        finish()
      })
    } else finish()
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

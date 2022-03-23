const bodyParser = require('body-parser')
const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
const shutdown = require('http-shutdown')
const debug = require('debug')('sonar-server')
const p = require('path')
const pinoExpress = require('express-pino-logger')

const swaggerUi = require('swagger-ui-express')

const { storagePath } = require('@arsonar/common/storage.js')
const { WorkspaceManager } = require('@arsonar/core')
const apiRouter = require('./handlers')
const Auth = require('./lib/auth')

const DEFAULT_PORT = 9191
const DEFAULT_HOSTNAME = 'localhost'

module.exports = function SonarServer (opts = {}) {
  const storage = storagePath(opts.storage)
  const config = {
    storage,
    auth: {
      disableAuthentication: opts.disableAuthentication
    },
    server: {
      hostname: opts.hostname || DEFAULT_HOSTNAME,
      port: opts.port || DEFAULT_PORT,
      dev: {}
    },
    workspace: {
      ...(opts.workspace || {}),
      storagePath: storage,
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
  const workspaces = new WorkspaceManager(config.workspace)
  const log = workspaces.log

  // Init express app.
  const app = express()

  // Assemble api object.
  const api = {
    auth,
    workspaces,
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
    logger: log,
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
  app.use(
    bodyParser.urlencoded({
      limit: '10MB',
      extended: true
    })
  )
  app.use(
    bodyParser.json({
      limit: '10MB',
      // Currently, the _search route accepts json encoded strings.
      // Remove once that changes.
      strict: false
    })
  )

  // CORS headers
  app.use(
    cors({
      origin: '*'
    })
  )

  // Main API
  const apiRoutes = apiRouter(api)

  // Serve the API at /api/v1
  app.use('/api/v1', apiRoutes)
  app.use('/api', apiRoutes)

  // Serve the swagger API docs at /api-docs
  try {
    const apiDocs = require('./docs/swagger.json')
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(apiDocs, {
        customCss: '.swagger-ui .topbar { display: none }'
      })
    )
  } catch (e) {}

  // Include the client api docs at /api-docs-client
  const clientApiDocsPath = p.join(
    p.dirname(require.resolve('@arsonar/client/package.json')),
    'apidocs'
  )
  app.use('/api-docs-client', express.static(clientApiDocsPath))

  // Include the static UI at /
  if (!config.server.dev.uiWatch) {
    const uiStaticPath = p.join(
      p.dirname(require.resolve('@arsonar/ui/package.json')),
      'dist'
    )
    app.use('/', express.static(uiStaticPath))
  } else {
    const uiDevMiddleware = require('@arsonar/ui/express-dev')
    api.log.warn('UI development server started. UI will rebuild on changes!')
    uiDevMiddleware(app)
  }

  // Error handling
  app.use(function (err, req, res, next) {
    const result = {
      error: err.message
    }
    res.err = err
    if (!err.statusCode && err.code === 'ENOENT') {
      err.statusCode = 404
    }
    res.status(err.statusCode || 500)
    res.send(result)
    api.log.error({ err, req, message: `Request ${req.url} produced error` })
  })

  // Dev middleware.
  if (devMiddleware) {
    devMiddleware.initBottom(app, config.server.dev)
  }

  let openPromise, closePromise

  async function start () {
    await api.workspaces.open()
    await api.auth.open()
    // TODO: Take from running express server instead.
    app.port = config.server.port
    app.hostname = config.server.hostname
    await new Promise((resolve, reject) => {
      const server = app.listen(
        config.server.port,
        config.server.hostname,
        err => {
          if (err) return reject(err)
          api.log.debug(
            `HTTP server listening on http://${app.hostname}:${app.port}`
          )
          app.opened = true
          resolve()
        }
      )
      // Mount the shutdown handler onto the server.
      app.server = shutdown(server)
    })
  }

  async function close () {
    api.log.trace('Starting to close')
    app.closing = true
    if (openPromise) await openPromise
    await new Promise(resolve => app.server.forceShutdown(resolve))
    await new Promise(resolve => api.auth.close(resolve))
    api.log.trace('HTTP server closed')
    await api.workspaces.close()
    api.log.trace('Workspace closed')
    app.closed = true
  }

  app.start = function (cb) {
    if (!openPromise) openPromise = start()
    if (cb) openPromise.then(cb, cb)
    else return openPromise
  }

  app.close = function (cb) {
    if (!closePromise) closePromise = close()
    if (cb) closePromise.then(cb, cb)
    else return closePromise
  }

  // Ensure everything gets closed when the node process exits.
  // TODO: This is disabled for now because it makes tests take forever sometimes.
  // Likely we only want to enable this only if not in test mode (to catch Ctrl-C).
  // onexit((cb) => {
  //   app.close(() => {
  //     cb()
  //   })
  // })

  return app
}

function noop () {}

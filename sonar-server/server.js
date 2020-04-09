const { IslandStore } = require('@arso-project/sonar-core')
const bodyParser = require('body-parser')
const onexit = require('async-exit-hook')
const express = require('express')
const cors = require('cors')
const expressWebSocket = require('express-ws')
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
  const config = {
    storage: opts.storage || DEFAULT_STORAGE,
    port: opts.port || DEFAULT_PORT,
    hostname: opts.hostname || DEFAULT_HOSTNAME
  }

  const storeOpts = {
    network: typeof opts.network === undefined ? true : opts.network
  }

  const api = {
    config,
    islands: new IslandStore(config.storage, storeOpts)
  }

  const app = express()
  expressWebSocket(app)

  app.api = api

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

  // Main API
  const apiRoutes = apiRouter(api)

  app.use('/api', apiRoutes)
  // TODO: Change to v1
  // app.use('/api/v1', apiRoutes)

  // API docs
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

  app.start = function (opts, cb) {
    if (typeof opts === 'function') return app.start(null, opts)
    api.islands.ready()
    opts = opts || {}
    app._port = opts.port || config.port
    app._host = opts.hostname || config.hostname
    app.server = app.listen(app._port, app._host, cb)
  }

  app.close = thunky(cb => {
    app.server.close()
    api.islands.close(cb)
  })

  onexit((cb) => {
    app.close(cb)
  })

  return app
}

function noop () {}

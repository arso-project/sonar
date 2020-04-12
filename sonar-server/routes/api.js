// const { hyperdriveHandler } = require('./hyperdrive')
const { Router } = require('simple-rpc-protocol')
const express = require('express')
const websocketStream = require('websocket-stream/stream')
const debug = require('debug')
const SSE = require('express-sse')
const log = debug('sonar:server')

const hyperdriveMiddleware = require('./hyperdrive')
const createIslandCommands = require('../commands/island')

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandlers(api.islands)
  const handlers = createIslandHandlers(api.islands)
  const commandHandler = createCommandStreamHandler(api.islands)

  // Info
  router.get('/_info', deviceHandlers.info)
  // Create island
  router.put('/_create/:name', deviceHandlers.createIsland)
  // Create command stream (websocket)
  router.ws('/_commands', commandHandler)

  const islandRouter = express.Router()
  // Change island config
  islandRouter.patch('/', deviceHandlers.updateIsland)

  // Hyperdrive actions (get and put)
  islandRouter.use('/fs', hyperdriveMiddleware(api.islands))

  // Create or update record
  islandRouter.put('/db', handlers.put)
  islandRouter.put('/db/:schema/:id', handlers.put)
  islandRouter.get('/db/:key/:seq', handlers.get)
  // Get record
  // islandRouter.get('/db/:schemans/:schemaname/:id', handlers.get)

  // Search/Query
  islandRouter.post('/_query/:name', handlers.query)
  // List schemas
  islandRouter.get('/schema', handlers.getSchemas)
  // Put schema
  islandRouter.post('/schema', handlers.putSchema)
  // Put source
  // TODO: This route should have the same pattern as the others.
  islandRouter.put('/source/:key', handlers.putSource)

  islandRouter.get('/debug', handlers.debug)

  islandRouter.put('/subscription/:name', handlers.createSubscription)
  islandRouter.get('/subscription/:name', handlers.pullSubscription)
  islandRouter.get('/subscription/:name/sse', handlers.pullSubscriptionSSE)
  islandRouter.post('/subscription/:name/:cursor', handlers.ackSubscription)

  islandRouter.get('/fs-info', function (req, res, next) {
    const { island } = req
    island.query('records', { schema: 'core/source' }, (err, records) => {
      if (err) return next(err)
      const drives = records
        .filter(record => record.value.type === 'hyperdrive')
        .map(record => record.value)
      let pending = drives.length
      drives.forEach(driveInfo => {
        island.fs.get(driveInfo.key, (err, drive) => {
          if (err) driveInfo.error = err.message
          else {
            driveInfo.writable = drive.writable
          }
          if (--pending === 0) res.send(drives)
        })
      })
      // res.send(drives)
    })
  })

  // Load island if in path.
  router.use('/:island', function (req, res, next) {
    const { island } = req.params
    if (!island) return next()
    api.islands.get(island, (err, island) => {
      if (err) return next(err)
      req.island = island
      next()
    })
  }, islandRouter)

  return router
}

function createCommandStreamHandler (islands) {
  const router = new Router({ name: 'server' })
  islands.on('close', () => {
    router.close()
  })
  const islandCommands = createIslandCommands(islands)
  router.service('island', islandCommands.commands, islandCommands.opts)
  router.on('error', log)
  return function createCommandStream (ws, _req) {
    const stream = websocketStream(ws, {
      binary: true
    })
    stream.on('error', err => {
      log(err)
    })
    router.connection(stream, { allowExpose: true })
  }
}

function createDeviceHandlers (islands) {
  return {
    info (req, res, next) {
      islands.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
    },

    createIsland (req, res, next) {
      const { name } = req.params
      const { key, alias } = req.body
      islands.create(name, { key, alias }, (err, island) => {
        if (err) return next(err)
        res.send({
          key: island.key.toString('hex')
        })
        res.end()
      })
    },

    updateIsland (req, res, next) {
      islands.updateIsland(req.island.key, req.body, (err, newConfig) => {
        if (err) return next(err)
        res.send(newConfig)
      })
    }
  }
}

// These handlers all expect a req.island property.
function createIslandHandlers () {
  return {
    put (req, res, next) {
      let record
      if (req.params.schema) {
        record = {
          id: req.params.id,
          schema: req.params.schema,
          value: req.body
        }
      } else {
        record = req.body
      }
      req.island.put(record, (err, id) => {
        if (err) return next(err)
        res.send({ id })
      })
    },

    get (req, res, next) {
      const { key, seq } = req.params
      req.island.loadRecord({ key, seq }, (err, record) => {
        if (err) return next(err)
        res.send(record)
      })
    },

    // TODO: This should be something different than get
    // and intead drive different kinds of queries.
    query (req, res, next) {
      const name = req.params.name
      const args = req.body
      const opts = req.query || {}
      req.island.query(name, args, opts, (err, records) => {
        if (err) return next(err)
        res.send(records)
      })
    },

    getSchemas (req, res, next) {
      if (req.query && req.query.name) {
        const schema = req.island.getSchema(req.query.name)
        if (!schema) return next(HttpError(404, 'Schema not found'))
        else res.send(schema)
      } else {
        const schemas = req.island.getSchemas()
        res.send(schemas)
      }
    },

    putSchema (req, res, next) {
      const schema = req.body
      const name = schema.name
      const island = req.island
      island.putSchema(name, schema, (err, id) => {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
        island.getSchema(name, (err, result) => {
          if (err) return next(err)
          res.send(result)
        })
      })
    },

    putSource (req, res, next) {
      const { key } = req.params
      const info = req.body
      req.island.putSource(key, info, (err) => {
        if (err) return next(err)
        return res.send({ msg: 'ok' })
      })
    },

    debug (req, res, next) {
      // const flows = Object.keys(req.island.db.kappa.flows)
      // console.log('flows', flows)
      // flows.forEach(flow => req.island.db.kappa.reset(flow))
      res.send(req.island.status())
      // req.island.getState((err, state) => {
      //   if (err) return next(err)
      //   res.send(state)
      // })
    },

    createSubscription (req, res, next) {
      const { name } = req.params
      const opts = req.query || {}
      req.island.createSubscription(name, opts)
      res.send({ name })
    },

    pullSubscription (req, res, next) {
      const { name } = req.params
      const opts = req.query || {}
      req.island.pullSubscription(name, opts, (err, result) => {
        if (err) return next(err)
        res.send(result)
      })
    },

    pullSubscriptionSSE (req, res, next) {
      const { name } = req.params
      const opts = req.query || {}
      opts.live = true

      const sse = new SSE()
      sse.init(req, res)

      const stream = req.island.pullSubscriptionStream(name, opts)
      stream.on('data', row => {
        sse.send(row, null, row.lseq)
      })
      stream.on('error', err => {
        sse.send({ error: err.message }, 'error')
        res.end()
      })
      // pump(stream, sse)
    },

    ackSubscription (req, res, next) {
      const { name, cursor } = req.params
      req.island.ackSubscription(name, cursor, (err, result) => {
        if (err) return next(err)
        res.send(result)
      })
    }
  }
}

function HttpError (code, message) {
  let err
  if (message instanceof Error) err = message
  else err = new Error(message)
  err.statusCode = code
  return err
}

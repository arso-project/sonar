// const { hyperdriveHandler } = require('./hyperdrive')
const { hyperdriveMiddleware } = require('./hyperdrive')
const collect = require('collect-stream')
const { Router } = require('simple-rpc-protocol')
const express = require('express')
const websocketStream = require('websocket-stream/stream')
const debug = require('debug')
const log = debug('sonar:server')

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandlers(api.islands)
  const handlers = createIslandHandlers(api.islands)

  // Info
  router.get('/_info', deviceHandlers.info)
  // Create island
  router.put('/_create/:name', deviceHandlers.createIsland)
  router.put('/_create/:name/:key', deviceHandlers.createIsland)

  // Hyperdrive actions (get and put)
  router.use('/:island/fs/*', hyperdriveMiddleware(api.islands))
  router.use('/:island/fs', hyperdriveMiddleware(api.islands))

  const islandRouter = express.Router()
  // Create command stream (websocket)
  const commandHandler = createCommandHandler(api.islands)
  islandRouter.ws('/commands', commandHandler)

  // Create record
  islandRouter.post('/db/:schemans/:schemaname', handlers.put)
  // Update record
  islandRouter.put('/db/:schemans/:schemaname/:id', handlers.put)
  // Get record
  islandRouter.get('/db/:schemans/:schemaname/:id', handlers.get)
  islandRouter.get('/db/:id', handlers.get)
  // Search/Query
  islandRouter.post('/_search', handlers.search)
  islandRouter.post('/_query', handlers.query)
  // List schemas
  islandRouter.get('/schema', handlers.getSchemas)
  // Get schema
  islandRouter.get('/schema/:schemans/:schemaname', handlers.getSchema)
  // Put schema
  islandRouter.put('/schema/:schemans/:schemaname', handlers.putSchema)
  // Put source
  // TODO: This route should have the same pattern as the others.
  islandRouter.put('/_source', handlers.putSource)

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

function createCommandHandler (islands) {
  const router = new Router({ name: 'server' })
  // router.command('ping', (args, channel) => {
  //   channel.reply('pong')
  //   channel.end()
  // })
  router.on('error', log)
  return function createCommandStream (ws, req) {
    // const { key } = req.params
    const stream = websocketStream(ws, {
      binary: true
    })
    stream.on('error', err => {
      log(err)
    })
    router.connection(stream)
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
      const { name, key } = req.params
      islands.create(name, key, (err, island) => {
        if (err) return next(err)
        res.send({
          key: island.key.toString('hex')
        })
      })
    }
  }
}

// These handlers all expect a req.island property.
function createIslandHandlers () {
  return {
    put (req, res, next) {
      const { id } = req.params
      const value = req.body
      const schema = expandSchema(req.island, req.params)
      req.island.put({ schema, id, value }, (err, id) => {
        if (err) return next(err)
        res.send({ id })
      })
    },

    get (req, res, next) {
      let { id } = req.params
      const schema = expandSchema(req.island, req.params)
      req.island.get({ schema, id }, (err, records) => {
        if (err) return next(err)
        res.send(records)
      })
    },

    // TODO: This should be something different than get
    // and intead drive different kinds of queries.
    query (req, res, next) {
      const { schema, id, source } = req.body
      req.island.get({ schema, id, source }, (err, records) => {
        if (err) return next(err)
        res.send(records)
      })
    },

    getSchemas (req, res, next) {
      const schemas = req.island.getSchemas()
      res.send(schemas)
    },

    getSchema (req, res, next) {
      let schema = expandSchema(req.island, req.params)
      req.island.getSchema(schema, (err, schemaValue) => {
        if (err) {
          err.statusCode = 404
          return next(err)
        }
        res.send(schemaValue)
      })
    },

    putSchema (req, res, next) {
      let schema = expandSchema(req.island, req.params)
      const island = req.island
      island.putSchema(schema, req.body, (err) => {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
        island.getSchema(schema, (err, result) => {
          if (err) return next(err)
          res.send({ schema })
        })
      })
    },

    putSource (req, res, next) {
      const { key: sourceKey } = req.body
      req.island.putSource(sourceKey, (err) => {
        if (err) return next(err)
        return res.send({ msg: 'ok' })
      })
    },

    search (req, res, next) {
      const query = req.body
      const island = req.island
      // Query can either be a string (tantivy query) or an object (toshi json query)
      const resultStream = island.db.api.search.query(query)
      replyStream(res, resultStream)
    }
  }
}

function expandSchema (island, { schemans, schemaname }) {
  if (!schemans || !schemaname) return null
  if (schemans === '_') schemans = island.key.toString('hex')
  const schema = schemans + '/' + schemaname
  return schema
}

function replyStream (res, stream) {
  const results = []
  let error = false
  stream.on('data', data => results.push(data))
  stream.on('error', err => (error = err))
  stream.on('close', () => {
    if (error) res.status(422).send({ error })
  })
  stream.on('end', () => {
    res.send(results)
  })
}

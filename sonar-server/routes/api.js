// const { hyperdriveHandler } = require('./hyperdrive')
const hyperdriveMiddleware = require('./hyperdrive')
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
  const commandHandler = createCommandHandler(api.islands)

  // Info
  router.get('/_info', deviceHandlers.info)
  // Create island
  router.put('/_create/:name', deviceHandlers.createIsland)

  const islandRouter = express.Router()
  // Change island config
  islandRouter.patch('/', deviceHandlers.updateIsland)
  // Create command stream (websocket)
  islandRouter.ws('/commands', commandHandler)

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
          driveInfo.writable = drive.writable
          if (--pending === 0) res.send(drives)
        })
      })
      // res.send(drives)
    })
  })

  // Load island if in path.
  router.use('/:island', function (req, res, next) {
    const { island } = req.params
    res.locals.key = island;
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
      const { name } = req.params
      const { key, alias } = req.body
      islands.create(name, { key, alias }, (err, island) => {
        if (err) return next(err)
        res.send({
          key: island.key.toString('hex')
        })
      })
    },
    updateIsland (req, res, next) {
      let config = {};
      if (req.body.hasOwnProperty('share')) {
        config = islands.updateIsland(res.locals.key, req.body) 
      }
      res.send(config)
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
      return res.end('not implemented')
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

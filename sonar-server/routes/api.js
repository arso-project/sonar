const express = require('express')
const hyperdriveMiddleware = require('./hyperdrive')

const createDeviceHandler = require('../handlers/device-handler')
const createCollectionHandler = require('../handlers/collection-handler')
const createCommandStreamHandler = require('../handlers/command-handler')

// const SYNC_TIMEOUT = 10000

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandler(api.islands)
  const handlers = createCollectionHandler(api.islands)
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

  // Island status info
  islandRouter.get('/', handlers.status)

  // Create or update record
  islandRouter.put('/db', handlers.put)
  islandRouter.put('/db/:id', handlers.put)
  islandRouter.delete('/db/:id', handlers.del)
  islandRouter.get('/db/:key/:seq', handlers.get)
  // Get record
  // islandRouter.get('/db/:schemans/:schemaname/:id', handlers.get)

  // Wait for sync
  islandRouter.get('/sync', handlers.sync)

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

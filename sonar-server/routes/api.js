const express = require('express')
const hyperdriveMiddleware = require('./hyperdrive')

const createDeviceHandler = require('../handlers/device-handler')
const createCollectionHandler = require('../handlers/collection-handler')
const createCommandStreamHandler = require('../handlers/command-handler')

// const SYNC_TIMEOUT = 10000

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandler(api.collections)
  const handlers = createCollectionHandler(api.collections)
  const commandHandler = createCommandStreamHandler(api.collections)

  // Info
  router.get('/_info', deviceHandlers.info)
  // Create collection
  router.put('/_create/:name', deviceHandlers.createCollection)
  // Create command stream (websocket)
  router.ws('/_commands', commandHandler)

  const collectionRouter = express.Router()
  // Change collection config
  collectionRouter.patch('/', deviceHandlers.updateCollection)

  // Hyperdrive actions (get and put)
  collectionRouter.use('/fs', hyperdriveMiddleware(api.collections))

  // Collection status info
  collectionRouter.get('/', handlers.status)

  // Create or update record
  collectionRouter.put('/db', handlers.put)
  collectionRouter.put('/db/:id', handlers.put)
  collectionRouter.delete('/db/:id', handlers.del)
  collectionRouter.get('/db/:key/:seq', handlers.get)
  // Get record
  // collectionRouter.get('/db/:schemans/:schemaname/:id', handlers.get)

  // Wait for sync
  collectionRouter.get('/sync', handlers.sync)

  // Search/Query
  collectionRouter.post('/_query/:name', handlers.query)
  // List schemas
  collectionRouter.get('/schema', handlers.getSchemas)
  // Put schema
  collectionRouter.post('/schema', handlers.putSchema)
  // Put source
  // TODO: This route should have the same pattern as the others.
  collectionRouter.put('/source/:key', handlers.putSource)

  collectionRouter.get('/debug', handlers.debug)

  collectionRouter.put('/subscription/:name', handlers.createSubscription)
  collectionRouter.get('/subscription/:name', handlers.pullSubscription)
  collectionRouter.get('/subscription/:name/sse', handlers.pullSubscriptionSSE)
  collectionRouter.post('/subscription/:name/:cursor', handlers.ackSubscription)

  collectionRouter.get('/fs-info', function (req, res, next) {
    const { collection } = req
    collection.query('records', { schema: 'core/source' }, (err, records) => {
      if (err) return next(err)
      const drives = records
        .filter(record => record.value.type === 'hyperdrive')
        .map(record => record.value)
      let pending = drives.length
      drives.forEach(driveInfo => {
        collection.fs.get(driveInfo.key, (err, drive) => {
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

  // Load collection if in path.
  router.use('/:collection', function (req, res, next) {
    const { collection } = req.params
    if (!collection) return next()
    api.collections.get(collection, (err, collection) => {
      if (err) return next(err)
      req.collection = collection
      next()
    })
  }, collectionRouter)

  return router
}

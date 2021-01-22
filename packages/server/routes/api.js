const express = require('express')

const createDeviceHandler = require('../handlers/device-handler')
const createCollectionRoutes = require('../handlers/collection-handler')
const createAuthHandler = require('../handlers/auth')
const createBotsRouter = require('../handlers/bots')

// const SYNC_TIMEOUT = 10000

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandler(api.workspace)
  const authHandler = createAuthHandler(api.auth)
  const collectionRoutes = createCollectionRoutes(api.workspace)
  const botRouter = createBotsRouter()

  router.use(authHandler.authMiddleware())

  // Login
  router.post('/login', authHandler.login)
  router.post('/create-access-code', authHandler.createAccessCode)

  // Bots
  router.use('/bot', botRouter)

  // Info
  router.get('/info', deviceHandlers.info)

  // Create collection
  router.post('/collection', deviceHandlers.createCollection)
  router.use('/collection', collectionRoutes)

  return router
}

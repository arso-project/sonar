const express = require('express')
const AH = require('../lib/async-handler')

const createDeviceHandler = require('../handlers/device-handler')
const createCollectionRoutes = require('../handlers/collection-handler')
const createAuthHandler = require('../handlers/auth')
const createBotsRouter = require('../handlers/bots')

// const SYNC_TIMEOUT = 10000

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const deviceHandlers = createDeviceHandler()
  const authHandler = createAuthHandler(api.auth)
  const collectionRoutes = createCollectionRoutes()
  const botRouter = createBotsRouter()

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

  const topRouter = express.Router()
  topRouter.use('/workspace/:workspace',
    authHandler.authMiddleware(),
    AH(workspaceMiddleware),
    router
  )

  return topRouter

  async function workspaceMiddleware (req, res, next) {
    // TODO: Check access to workspace!
    const workspaceName = req.params.workspace
    const workspace = await api.workspaces.getWorkspace(workspaceName)
    req.workspace = workspace
    next()
  }
}

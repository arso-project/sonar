const express = require('express')
const AH = require('../lib/async-handler')

const createWorkspaceHandler = require('./workspace')
const createCollectionRoutes = require('./collection')
const createAuthHandler = require('./auth')
const createBotsRouter = require('./bots')

// const SYNC_TIMEOUT = 10000

module.exports = function apiRoutes (api) {
  const router = express.Router()

  // Top level actions
  const workspaceHandlers = createWorkspaceHandler()
  const authHandler = createAuthHandler(api.auth)
  const collectionRoutes = createCollectionRoutes()
  const botRouter = createBotsRouter()

  // Middlewares
  router.use('/:workspace', authHandler.authMiddleware())
  router.use('/:workspace', AH(workspaceMiddleware))

  // Workspace routes
  router.get('/:workspace', workspaceHandlers.info)

  // Auth routes
  router.post('/:workspace/login', authHandler.login)
  router.post('/:workspace/register', authHandler.register)

  // Bots
  router.use('/:workspace/bot', botRouter)

  // Collection routes
  router.use('/:workspace/collection', collectionRoutes)

  // 404 handler
  router.all('/*', (req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  return router

  async function workspaceMiddleware (req, res, next) {
    // TODO: Check access to workspace!
    const workspaceName = req.params.workspace
    const workspace = await api.workspaces.getWorkspace(workspaceName)
    req.workspace = workspace
    req.workspaceName = workspaceName
    next()
  }
}

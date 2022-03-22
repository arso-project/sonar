const { Router } = require('simple-rpc-protocol')
const websocketStream = require('websocket-stream/stream')
const debug = require('debug')('sonar-server:api')
const log = debug
const createCollectionCommands = require('../commands/collection')

module.exports = function createCommandStreamHandler (collections) {
  const router = new Router({ name: 'server' })
  collections.on('close', () => {
    router.close()
  })
  const collectionCommands = createCollectionCommands(collections)
  router.service(
    'collection',
    collectionCommands.commands,
    collectionCommands.opts
  )
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

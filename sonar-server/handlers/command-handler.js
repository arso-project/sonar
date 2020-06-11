const { Router } = require('simple-rpc-protocol')
const websocketStream = require('websocket-stream/stream')
const debug = require('debug')('sonar-server:api')
const log = debug
const createIslandCommands = require('../commands/island')

module.exports = function createCommandStreamHandler (islands) {
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

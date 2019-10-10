const { IslandManager } = require('@arso-project/sonar-dat')
const Fastify = require('fastify')

const apiRoutes = require('./routes/api')
const hyperdriveRoutes = require('./routes/hyperdrive')

module.exports = function createServer (opts) {
  const fastify = Fastify({ logger: true })

  const path = opts.path || '../.data'
  const islands = new IslandManager(path)

  fastify.register(apiRoutes, { islands, prefix: 'api' })
  fastify.register(hyperdriveRoutes, { islands, prefix: 'fs' })

  return fastify
}

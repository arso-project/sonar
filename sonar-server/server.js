const { IslandManager } = require('@arso-project/sonar-dat')
const Fastify = require('fastify')

const apiRoutes = require('./routes/api')

module.exports = function createServer (opts) {
  const fastify = Fastify({ logger: true })

  const path = opts.path || '../.data'
  const islands = new IslandManager(path)

  fastify.register(apiRoutes, { islands })

  return fastify
}

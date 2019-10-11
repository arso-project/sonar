const { IslandManager } = require('@arso-project/sonar-dat')
const Fastify = require('fastify')

const fastifyCors = require('fastify-cors')

const apiRoutes = require('./routes/api')
const hyperdriveRoutes = require('./routes/hyperdrive')

module.exports = function createServer (opts) {
  opts.logger = typeof opts.logger === 'undefined' ? true : opts.logger
  const fastify = Fastify({ logger: opts.logger })

  const storagePath = opts.storage || '../.data'
  const islands = new IslandManager(storagePath)

  fastify.register(fastifyCors)
  fastify.register(apiRoutes, { islands, prefix: 'api' })
  fastify.register(hyperdriveRoutes, { islands, prefix: 'fs' })

  fastify.addHook('onClose', (instance, done) => {
    islands.close()
    done()
  })

  return fastify
}

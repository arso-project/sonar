const Server = require('@arsonar/server/test/lib/create')
const { Workspace } = require('../..')

module.exports = { createOne, createMany }

async function createOne (opts = {}) {
  const { server, endpoint, cleanup: cleanupServer } = await Server.createOne(
    opts
  )
  const clientOpts = opts.clientOpts || {}
  const client = new Workspace({ endpoint, ...clientOpts })
  return { server, cleanup, endpoint, client }
  async function cleanup () {
    await client.close()
    await cleanupServer()
  }
}

async function createMany (n, opts = {}) {
  const instances = await Server.createMany(n, opts)
  instances.clients = instances.endpoints.map(endpoint => {
    return new Workspace({ endpoint })
  })
  const cleanup = instances.cleanup
  instances.cleanup = async function () {
    await Promise.all(instances.clients.map(client => client.close()))
    await cleanup()
  }
  return instances
}

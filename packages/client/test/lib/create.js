const Server = require('@arsonar/server/test/lib/create')
const Client = require('../..')

module.exports = { createOne, createMany }

async function createOne (opts = {}) {
  const { server, endpoint, cleanup: cleanupServer } = await Server.createOne(opts)
  const clientOpts = opts.clientOpts || {}
  const client = new Client({ endpoint, ...clientOpts })
  await client.createCollection('default')
  return { server, cleanup, endpoint, client }
  async function cleanup () {
    await client.close()
    await cleanupServer()
  }
}

async function createMany (n, opts = {}) {
  const instances = await Server.createMany(n, opts)
  instances.clients = instances.endpoints.map(endpoint => {
    return new Client({ endpoint })
  })
  const cleanup = instances.cleanup
  instances.cleanup = async function () {
    await Promise.all(instances.clients.map(client => client.close()))
    await cleanup()
  }
  return instances
}

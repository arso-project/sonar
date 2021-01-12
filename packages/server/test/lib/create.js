const createServer = require('../..')
const tmp = require('tmp-promise')
const findFreePorts = require('find-free-ports')
require('make-promises-safe')
tmp.setGracefulCleanup()

module.exports = { createOne, createMany }

async function createMany (n, opts = {}) {
  const servers = []
  const endpoints = []
  const cleanups = []
  const ports = await findFreePorts(n, { startPort: 10000 })

  // let DHT
  // if (opts.network !== false) {
  //   DHT = await createDHT()
  //   cleanups.push(DHT.cleanup)
  //   opts.bootstrap = DHT.bootstrap
  // }

  const instances = await Promise.all(ports.map(
    port => createOne({ ...opts, port })
  ))

  for (let i = 0; i < n; i++) {
    const { server, endpoint, cleanup } = instances[i]
    servers.push(server)
    endpoints.push(endpoint)
    cleanups.push(cleanup)
  }
  return { servers, endpoints, cleanup }
  async function cleanup () {
    await Promise.all(cleanups.map(cleanup => cleanup()))
  }
}

async function createOne (opts = {}) {
  if (opts.disableAuthentication === undefined) {
    opts.disableAuthentication = true
  }
  if (opts.persist === undefined) {
    opts.persist = false
  }
  if (!opts.port) {
    opts.port = await findFreePort()
  }
  if (!opts.bootstrap) {
    opts.bootstrap = false
    opts.network = false
  }

  let cleanupStorage
  if (!opts.storage) {
    const { storage, cleanup } = await createStorage()
    cleanupStorage = cleanup
    opts.storage = storage
  }

  const server = createServer(opts)
  await new Promise((resolve, reject) => {
    server.start(err => err ? reject(err) : resolve())
  })

  const endpoint = `http://localhost:${opts.port}/api`

  return { server, cleanup, endpoint }

  async function cleanup () {
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve())
    })
    await Promise.all([
      cleanupStorage || Promise.resolve()
    ])
  }
}

async function createStorage () {
  const { path, cleanup } = await tmp.dir({
    prefix: 'sonar-test',
    unsafeCleanup: true
  })
  return { storage: path, cleanup }
}

async function findFreePort () {
  const ports = await findFreePorts(1, { startPort: 10000 })
  if (!ports.length) throw new Error('No free ports')
  return ports[0]
}

// async function createDHT () {
//   const bootstrapper = require('@hyperswarm/dht')({
//     bootstrap: false
//   })
//   bootstrapper.listen()
//   await new Promise(resolve => {
//     return bootstrapper.once('listening', resolve)
//   })
//   const bootstrapPort = bootstrapper.address().port
//   const bootstrapOpt = [`localhost:${bootstrapPort}}`]
//   return { bootstrap: bootstrapOpt, cleanup }

//   async function cleanup () {
//     await bootstrapper.destroy()
//   }
// }

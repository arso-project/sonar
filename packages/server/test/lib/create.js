const createServer = require('../..')
const tmp = require('tmp-promise')
const findFreePorts = require('find-free-ports')
require('make-promises-safe')
tmp.setGracefulCleanup()

const CLEANUP_TIMEOUT = 5000

module.exports = { createOne, createMany }

async function createMany (n, opts = {}) {
  const servers = []
  const endpoints = []
  const cleanups = []
  const ports = await findFreePorts(n, { startPort: 10000 })

  // TODO: Test work without this too, why is that? mDNS maybe?
  // let DHT
  // if (opts.network !== false) {
  //   DHT = await createDHT()
  //   cleanups.push(DHT.cleanup)
  //   opts.bootstrap = DHT.bootstrap
  // }

  const instances = await Promise.all(
    ports.map(port => createOne({ ...opts, port }))
  )

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
    server.start(err => (err ? reject(err) : resolve()))
  })

  const endpoint = `http://localhost:${opts.port}/api`

  return { server, cleanup, endpoint }

  async function cleanup () {
    // await abortAfter(CLEANUP_TIMEOUT, 'Cleanup timeout', async () => {
    // })
    await new Promise((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()))
    })
    if (cleanupStorage) await cleanupStorage()
  }
}

async function abortAfter (ms, message, fn) {
  await Promise.race([
    fn(),
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
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

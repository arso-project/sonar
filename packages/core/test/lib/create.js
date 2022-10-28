const tmpPromise = require('tmp-promise')
const createTestnet = require('@hyperswarm/testnet')
const createSDK = require('../../lib/sdk')
const { Workspace } = require('../..')

module.exports = {
  createOne,
  createMany,
  createSDK,
  createDHT
}

async function createOne (opts = {}) {
  let cleanupStorage
  // Use in-memory storage where possible by default (faster)
  if (opts.persist === undefined) {
    opts.persist = false
  }
  // Disable networking by default (don't bootstrap the DHT)
  if (!opts.swarmOpts) {
    opts.swarmOpts = { bootstrap: false }
  }

  if (!opts.storagePath) {
    const { storage, cleanup } = await createStorage()
    cleanupStorage = cleanup
    opts.storagePath = storage
  }

  const workspace = new Workspace(opts)
  await workspace.open()

  return { workspace, cleanup }

  async function cleanup () {
    await workspace.close()
    if (cleanupStorage) await cleanupStorage()
  }
}

async function createMany (n, opts = {}) {
  const workspaces = []
  const cleanups = []

  const { bootstrap, cleanup: cleanupDHT } = await createDHT()

  opts.swarmOpts = { bootstrap }

  for (let i = 0; i < n; i++) {
    const { workspace, cleanup } = await createOne({ ...opts })
    workspaces.push(workspace)
    cleanups.push(cleanup)
  }
  return { workspaces, cleanup, bootstrap }

  async function cleanup () {
    await abortAfter(1000, 'Cleanup timeout', async () => {
      await Promise.all(cleanups.map(cleanup => cleanup()))
      await cleanupDHT()
    })
  }
}

async function createStorage () {
  const { path, cleanup } = await tmpPromise.dir({
    prefix: 'sonar-test',
    unsafeCleanup: true
  })
  return { storage: path, cleanup }
}

async function abortAfter (ms, message, fn) {
  await Promise.race([
    fn(),
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

async function createDHT () {
  const testnet = await createTestnet(2)
  return {
    bootstrap: testnet.bootstrap,
    async cleanup () {
      await testnet.destroy()
    }
  }
}

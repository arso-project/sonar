const tmp = require('temporary-directory')
const tmpPromise = require('tmp-promise')
const { Workspace, LegacyWorkspace } = require('../..')

module.exports = Object.assign(createStore, {
  createOne,
  createMany
})

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
  return { workspaces, cleanup }

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
  const bootstrapper = require('@hyperswarm/dht')({
    bootstrap: false
  })
  bootstrapper.listen()
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })
  const bootstrapPort = bootstrapper.address().port
  const bootstrapOpt = [`localhost:${bootstrapPort}}`]
  return { bootstrap: bootstrapOpt, cleanup }

  async function cleanup () {
    await bootstrapper.destroy()
  }
}

// TODO: Remove.
function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  cb = maybepify(cb)
  opts.swarmOpts = { bootstrap: false }
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const collections = new LegacyWorkspace(dir, opts)
    collections.ready(err => {
      if (err) return cb(err)
      cb(null, collections, cleanup)
    })
    function cleanup (cb) {
      cb = maybepify(cb)
      collections.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
      return cb.promise
    }
  }
  return cb.promise
}

function maybepify (cb) {
  if (!cb) {
    let pargs
    const callback = (err, ...res) => {
      if (err) return pargs.reject(err)
      if (res.length === 1) pargs.resolve(res[0])
      else pargs.resolve(res)
    }
    const promise = new Promise((resolve, reject) => {
      pargs = { resolve, reject }
    })
    callback.promise = promise
    return callback
  } else {
    cb.promise = undefined
    return cb
  }
}

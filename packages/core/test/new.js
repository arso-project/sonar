const test = require('tape')
const { promisify } = require('util')
const tempdir = promisify(require('temporary-directory'))
const rimraf = promisify(require('rimraf'))
// const why = require('why-is-node-running')

const createNative = require('hyper-sdk/test/lib/native')
const createHyperspace = require('hyper-sdk/test/lib/hyperspace')
const createMixed = require('hyper-sdk/test/lib/mixed')

const { Workspace } = require('..')

// Prepare and patch tape
Error.stackTraceLimit = 50
applyStacktrace()

// Run tests
runAll()

function runAll () {
  run(createNative, 'native')
  const only = !!test.getHarness()._results._only
  if (!only) {
    run(createHyperspace, 'hyperspace')
    run(createMixed, 'mixed')
  }
}

function run (createSDK, label) {
  applyLabel()
  runTests(createN.bind(null, createSDK))
  applyLabel(label)
}

async function createN (createSDK, n, opts = {}) {
  if (n > 2) throw new Error('Only two SDKs supported')
  const { sdks, cleanup: cleanupSDK } = await createSDK(n)

  const dirs = []
  const workspaces = []

  for (const sdk of sdks) {
    const dir = await tempdir('sonar-test')
    const workspace = new Workspace({
      storagePath: dir,
      sdk,
      persist: opts.persist || false
      // swarmOpts: {
      //   bootstrap: false
      // }
    })
    dirs.push(dir)
    workspaces.push(workspace)
  }
  await Promise.all(workspaces.map(workspace => workspace.ready()))

  return [...workspaces, cleanup]

  async function cleanup () {
    try {
      await Promise.all(workspaces.map(workspace => workspace.close()))
      await new Promise(resolve => setTimeout(resolve, 200))
      await Promise.all(sdks.map(sdk => sdk.close()))
      await new Promise(resolve => setTimeout(resolve, 200))
      cleanupSDK()
      await Promise.all(dirs.map(dir => rimraf(dir)))
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (err) {
      console.error('Closing error', err)
    }
  }
}

const DOC_SPEC = {
  name: 'doc',
  fields: {
    title: { type: 'string' }
  }
}

async function setup (collection) {
  await collection.open()
  await collection.putType(DOC_SPEC)
  await collection.put({
    type: 'doc',
    value: { title: 'hello' }
  })
}

function runTests (create) {
  test('basic put and get', async t => {
    // try {
    const [w1, cleanup] = await create(1)
    const c1 = await w1.createCollection('default')
    await setup(c1)
    const res = await c1.query('records', { type: 'doc' })
    t.equal(res.length, 1)
    const record = res[0]
    t.equal(record.get('title'), 'hello')
    t.equal(record.key, c1.key.toString('hex'))

    const sameRecord = await c1.getRecord({
      key: record.key,
      seq: record.seq
    })
    // TODO: deepEqual fails for equal records, find out why and fix.
    t.deepEqual(record._record, sameRecord._record)
    await cleanup()
    // }catch(err){console.error(err)}
  })

  test('basic replication', { timeout: 5000 }, async t => {
    const [w1, w2, cleanup] = await create(2)

    const c1 = await w1.createCollection('default')
    await setup(c1)

    const c2 = await w2.createCollection(c1.key)
    await c2.open()
    await c2.sync()

    let res = await c2.query('records', { type: 'doc' })
    t.equal(res.length, 1, 'c2 len ok')
    const record = res[0]
    t.equal(record && record.get('title'), 'hello', 'c2 val ok')

    const updatedRecord = record.update({ title: 'hi' })
    await c2.put(updatedRecord)
    await c2.sync()
    res = await c2.query('records', { type: 'doc' })
    t.equal(res.length, 1, 'c2 len ok')
    t.equal(res[0].get('title'), 'hi', 'c2 val updated')

    await c1.putFeed(c2.localKey)
    await waitForUpdate(c1, true)

    res = await c1.query('records', { type: 'doc' })
    t.equal(res.length, 1)
    t.equal(res[0].get('title'), 'hi', 'c1 query correct')

    await cleanup()

    async function waitForUpdate (col) {
      await new Promise(resolve => col.once('update', resolve))
      await col.sync()
    }
  })

  test('open and close and open', async t => {
    let [workspace, cleanup] = await create(1, { persist: true })
    let col = await workspace.createCollection('first')
    await col.ready()
    await col.putType(DOC_SPEC)
    const type1 = col.schema.getType('doc')
    t.equal(type1.name, 'doc')

    const sdk = workspace._sdk
    const storagePath = workspace._storagePath

    await workspace.close()
    await timeout(200)

    workspace = new Workspace({ storagePath, sdk })
    await workspace.open()
    col = await workspace.createCollection('first')
    await col.ready()
    const key = col.key
    const type2 = col.schema.getType('doc')
    t.equal(type2.name, 'doc')
    t.deepEqual(type1, type2)
    await workspace.close()
    await timeout(200)

    workspace = new Workspace({ storagePath, sdk })
    await workspace.ready()
    col = await workspace.openCollection(key)
    await col.ready()
    const type3 = col.schema.getType('doc')
    t.equal(type3.name, 'doc')
    t.deepEqual(type1, type2)
    await workspace.close()

    await cleanup()
  })

  test('replication with 3 workspaces', async t => {
    const [w1, w2, cleanup] = await create(2)
    const c1 = await w1.createCollection('foo')
    const c2 = await w2.createCollection('foo')
    const { id } = await c1.put({
      type: 'sonar/entity',
      value: { label: 'foo1' }
    })
    await c2.putFeed(c1.localKey)
    await c1.putFeed(c2.localKey)
    await timeout(100)
    await c2.sync()
    await c2.put({ id, type: 'sonar/entity', value: { label: 'foo1 edit' } })
    await timeout(100)
    await c2.sync()
    await c1.sync()
    const res1 = await c1.query('records', { type: 'sonar/entity' })
    t.equal(res1[0].value.label, 'foo1 edit')
    const res2 = await c2.query('records', { type: 'sonar/entity' })
    t.equal(res2[0].value.label, 'foo1 edit')

    // close first workspace
    await c1.close()
    await w1.close()
    // create third workspace
    const [w3, cleanup2] = await create(1)
    const c3 = await w3.createCollection('foo')
    await c3.putFeed(c2.localKey)
    await timeout(100)
    await c3.sync()
    const res3 = await c3.query('records', { type: 'sonar/entity' })
    const oldVersion = await c3.get({ address: res3[0].links[0] })
    t.equal(oldVersion[0].value.label, 'foo1')
    await cleanup()
    await cleanup2()
  })
}

async function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function applyLabel (label) {
  const harness = test.getHarness()
  const lastLabel = harness._lastLabel || 0
  harness._lastLabel = harness._tests.length
  harness._tests.slice(lastLabel).forEach(test => {
    if (label) test.name = label + ': ' + test.name
  })
}

function applyStacktrace () {
  process.nextTick(() => {
    const harness = test.getHarness()
    for (const test of harness._tests) {
      const origCb = test._cb
      test._cb = handler.bind(null, origCb)
      test._cb.name = origCb.name
    }
  })

  function handler (origCb, t, ...args) {
    try {
      let maybePromise = origCb(t, ...args)
      if (maybePromise && maybePromise.then) {
        return maybePromise.catch(async err => {
          console.error('Original error', err)
          throw err
          // t.fail(err)
          // t.end()
        })
      }
    } catch (err) {
      t.fail(err)
      t.end()
    }
  }
}

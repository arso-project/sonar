const test = require('tape')
const { Workspace, Collection } = require('..')
const { promisify } = require('util')
const tempdir = promisify(require('temporary-directory'))
const rimraf = promisify(require('rimraf'))

const createNative = require('dat-sdk/test/lib/native')
const createHyperspace = require('dat-sdk/test/lib/hyperspace')
const createMixed = require('dat-sdk/test/lib/mixed')

Error.stackTraceLimit = 50

runAll()

function runAll () {
  run(createNative, 'native')
  run(createHyperspace, 'hyperspace')
  run(createMixed, 'mixed')
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
      persist: false
    })
    dirs.push(dir)
    workspaces.push(workspace)
  }
  await Promise.all(workspaces.map(workspace => workspace.ready()))

  return [...workspaces, cleanup]

  async function cleanup () {
    try {
      await Promise.all(workspaces.map(workspace => workspace.close()))
      sdks.forEach(sdk => sdk.close())
      cleanupSDK()
      await Promise.all(dirs.map(dir => rimraf(dir)))
    } catch (err) { console.error('Closing error', err) }
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
  await collection.sync()
}

function runTests (create) {
  test('basic put and get', async t => {
    // try {
    const [w1, cleanup] = await create(1)
    const c1 = w1.Collection('default')
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

  test('basic replication', async t => {
    const [w1, w2, cleanup] = await create(2)
    const c1 = w1.Collection('default')
    await setup(c1)
    const c2 = w2.Collection(c1.key)
    await c2.open()
    c1.use('debug', async records => {
      // console.log('IN C1', records)
    })
    c2.use('debug', async records => {
      // console.log('IN C2', records)
    })
    // console.log('w1', w1.network.allStatuses())
    // console.log('w2', w2.network.allStatuses())
    // console.log('c1', c1)
    // console.log('c2', c2)

    // await peerConnected

    await c2.rootFeed.update()
    // console.log('c2 post update', c2)
    await c2.rootFeed.download({ start: 0, end: c2.rootFeed.length })
    // console.log('c2 post download', c2)

    await timeout(50)
    await c2.update()
    // console.log('post s1')
    await timeout(50)
    // console.log('post s2')
    await c2.sync()

    let res = await c2.query('records', { type: 'doc' })
    t.equal(res.length, 1)
    const record = res[0]
    t.equal(record.get('title'), 'hello')

    const updatedRecord = record.update({ title: 'hi' })
    await c2.put(updatedRecord)
    await c2.sync()
    res = await c2.query('records', { type: 'doc' })
    // console.log('c2 q after put', res)
    // console.log('now add c2 feed to c1')
    await c1.putFeed(c2.localKey)

    await update(c1, 'first')
    // await waitForFeed(c1)
    // await update(c1, 'second')
    // await waitForFeed(c1)
    await update(c1, 'third')

    res = await c1.query('records', { type: 'doc' })
    // console.log('c1 q after sync', res)
    t.equal(res.length, 1)
    t.equal(res[0].get('title'), 'hi')

    // console.log('c1', c1.status())
    // console.log('c2', c2.status())
    await cleanup()

    async function update (c, name) {
      // console.log(name + 'UP - wait dl')
      await new Promise(resolve => {
        c.once('feed-update', resolve)
      })
      await new Promise(resolve => process.nextTick(resolve))
      // console.log(name + 'UP - wait up')
      await c.update()
      // console.log(name + 'UP - done')
    }

    // async function waitForFeed (c) {
    //   await new Promise(resolve => {
    //     c.once('feed', feed => {
    //       resolve()
    //     })
    //   })
    // }
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

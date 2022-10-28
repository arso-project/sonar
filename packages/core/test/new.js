const test = require('tape')
const { createMany, createOne } = require('./lib/create')
const { Workspace } = require('..')

// Prepare and patch tape
Error.stackTraceLimit = 50
applyStacktrace()

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

test.skip('replication smoke test', async t => {
  const createTestnet = require('@hyperswarm/testnet')
  const Hyperswarm = require('hyperswarm')
  const noop = () => {}

  const { bootstrap } = await createTestnet(3, t.teardown)
  console.log('bs', bootstrap)

  const swarm1 = new Hyperswarm({ bootstrap })
  const swarm2 = new Hyperswarm({ bootstrap })
  const connected = new Promise(resolve => {
    swarm1.on('connection', (conn, peerInfo) => {
      conn.on('error', noop)
      conn.end()
      // console.log('incoming on 1', peerInfo)
      setTimeout(resolve, 100)
    })
    swarm2.on('connection', (conn, peerInfo) => {
      conn.on('error', noop)
      conn.end()
      // console.log('incoming on 2', peerInfo)
    })
  })

  const topic = Buffer.alloc(32).fill('hello world')
  const disco1 = swarm1.join(topic, { server: true, client: true })
  await disco1.flushed()
  const disco2 = swarm2.join(topic, { server: true, client: true })
  await disco2.flushed()
  // console.log('1 joined', await disco1.flushed())
  // console.log('2 joined', await disco2.flushed())
  await connected
  t.equal(true, true)
  await swarm1.destroy()
  await swarm2.destroy()
})

test('basic put and get', async t => {
  // try {
  const { workspace: w1, cleanup } = await createOne()
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

test('basic replication', { timeout: 50000 }, async t => {
  const { workspaces: [w1, w2], cleanup } = await createMany(2)

  const c1 = await w1.createCollection('default')
  await setup(c1)

  let res = await c1.query('records', { type: 'doc' })
  t.equal(res.length, 1, 'c1 len ok')
  let record = res[0]
  t.equal(record && record.get('title'), 'hello', 'c2 val ok')

  const c2 = await w2.createCollection(c1.key)
  await c2.open()
  await c2.sync()

  res = await c2.query('records', { type: 'doc' })
  t.equal(res.length, 1, 'c2 len ok')
  record = res[0]
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
  let { workspace, cleanup } = await createOne({ persist: true })
  let col = await workspace.createCollection('first')
  await col.ready()
  await col.putType(DOC_SPEC)
  const type1 = col.schema.getType('doc')
  t.equal(type1.name, 'doc')

  // const sdk = workspace._sdk
  const storagePath = workspace._storagePath

  await workspace.close()
  await timeout(200)

  workspace = new Workspace({ storagePath })
  await workspace.open()
  col = await workspace.createCollection('first')
  await col.ready()
  const key = col.key
  const type2 = col.schema.getType('doc')
  t.equal(type2.name, 'doc')
  t.deepEqual(type1, type2)
  await workspace.close()
  await timeout(200)

  workspace = new Workspace({ storagePath })
  await workspace.ready()
  col = await workspace.openCollection(key)
  await col.ready()
  const type3 = col.schema.getType('doc')
  t.equal(type3.name, 'doc')
  t.deepEqual(type1, type2)
  await workspace.close()

  await cleanup()
})

// TODO v10: Find out why the timeouts are needed.
test('replication with 3 workspaces', async t => {
  const { workspaces: [w1, w2, w3], cleanup } = await createMany(3)
  const c1 = await w1.createCollection('foo')
  const c2 = await w2.createCollection('foo')
  const { id } = await c1.put({
    type: 'sonar/entity',
    value: { label: 'foo1' }
  })
  await c2.putFeed(c1.localKey)
  await c1.putFeed(c2.localKey)

  await timeout(10000)
  await c2.sync()

  await c2.put({ id, type: 'sonar/entity', value: { label: 'foo1 edit' } })

  await timeout(5000)
  await c2.sync()
  await c1.sync()

  const res1 = await c1.query('records', { type: 'sonar/entity' })
  t.equal(res1[0].value.label, 'foo1 edit')
  const res2 = await c2.query('records', { type: 'sonar/entity' })
  t.equal(res2[0].value.label, 'foo1 edit')

  await c1.close()
  await w1.close()

  const c3 = await w3.createCollection('foo')
  await c3.putFeed(c2.localKey)
  await c3.sync()
  await timeout(5000)
  const res3 = await c3.query('records', { type: 'sonar/entity' })
  const oldVersion = await c3.get({ address: res3[0].links[0] })
  t.equal(oldVersion[0].value.label, 'foo1')
  await cleanup()
  // await cleanup2()
})

async function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
}

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

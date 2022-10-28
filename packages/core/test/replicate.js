const tape = require('tape')
const { replicate } = require('./lib/util')
const pretty = require('pretty-hash')
const { createOne, createMany } = require('./lib/create')

tape('put query without replication', async t => {
  const { workspace, cleanup } = await createOne()
  const collection = await workspace.createCollection('collection1')
  await collection.ready()
  await collection.putType({
    name: 'doc',
    fields: { title: { type: 'string' } }
  })
  const record = await collection.put({ type: 'doc', value: { title: 'foo' } })
  const id = record.id
  await collection.put({ type: 'doc', value: { title: 'bar' }, id })
  const records = await collection.query(
    'records',
    { type: 'doc' },
    { waitForSync: true }
  )
  t.equal(records.length, 1)
  t.equal(records[0].value.title, 'bar')
  await cleanup()
})

function doc (title, id) {
  return { type: 'doc', value: { title }, id }
}

// TODO v10 test is very slow
tape('simple replication', { timeout: 50000 }, async t => {
  const { workspaces, cleanup } = await createMany(2)
  const [workspace1, workspace2] = workspaces

  const collection = await workspace1.createCollection('collection1')
  // await logCollection(collection, cb)
  await collection.ready()
  // await { console.log('COLLECTION 1 READY!!'); cb() }
  await collection.putType({
    name: 'doc',
    fields: { title: { type: 'string' } }
  })
  // await { console.log('COLLECTION 1 TYPE PUT DONE, NOW PUT DOC !!'); cb() }
  const record = await collection.put(doc('1rev1'))
  const id = record.id
  await collection.sync()
  await collection.put(doc('1rev2', id))
  const collection2 = await workspace2.createCollection(collection.key, {
    name: 'collection2',
    alias: 'writer2'
  })
  await checkOne(t, collection, { type: 'doc' }, '1rev2', 'init collection1 ok')
  // await logCollection(collection2, cb)
  replicate(collection, collection2)
  await collection2.sync()
  // await waitForUpdate(collection2)
  // TODO: Find an event callback that tells us when colleciton2 has updated.
  await checkOne(
    t,
    collection2,
    { type: 'doc' },
    '1rev2',
    'init collection2 ok'
  )
  const collection2localkey = collection2.localKey
  await collection.putFeed(collection2localkey, { alias: 'w2' })
  // TODO v10: Remove timeout
  await timeout(5000)
  await collection.sync()
  await collection2.put(doc('2rev1', id))
  // await waitForUpdate(collection)
  await checkOne(t, collection, { type: 'doc' }, '2rev1', 'end collection1 ok')
  await checkOne(t, collection2, { type: 'doc' }, '2rev1', 'end collection2 ok')

  await cleanup()
})

async function checkOne (t, collection, query, title, msg, cb) {
  const records = await collection.query('records', query, {
    waitForSync: true
  })
  // console.log({ msg, query, value, records })
  t.equal(records.length, 1, msg + ' (result len)')
  t.equal(records[0].value.title, title, msg + ' (value)')
}

function logCollection (collection, cb) {
  collection.scope.use('_debuglog', {
    map (msgs, next) {
      console.log(
        collection.name,
        'MAP',
        msgs.map(
          r => `[${r.lseq}] ${pretty(r.key)} @ ${r.seq}: ${r.type} ${r.id}`
        )
      )
      next()
    }
  })
  if (cb) cb()
}
async function waitForUpdate (col) {
  await new Promise(resolve => col.once('update', resolve))
  await col.update()
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

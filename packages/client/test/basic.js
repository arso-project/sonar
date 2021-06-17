const tape = require('tape')
const { promisify } = require('util')
const collect = promisify(require('stream-collector'))
const { Readable } = require('stream')

const { createOne } = require('./lib/create')

tape('minimal open and put', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('foobar')
  await collection.putType({
    name: 'doc',
    fields: {
      title: {
        type: 'string'
      }
    }
  })
  const putted = await collection.put({ type: 'doc', value: { title: 'hello world' } })
  const queried = await collection.query('records', { id: putted.id }, { waitForSync: true })
  t.equal(queried.length, 1)
  t.equal(queried[0].id, putted.id, 'id matches')
  await cleanup()
  t.ok(true, 'cleanup ok')
})

tape('db basic put and query', async t => {
  const { client, cleanup } = await createOne({ network: false })

  const collection = await client.createCollection('foobar')
  await collection.putType({
    name: 'doc',
    fields: {
      title: {
        type: 'string'
      }
    }
  })
  await collection.putType({
    name: 'fun',
    title: 'Fun things',
    fields: {
      color: {
        type: 'string'
      }
    }
  })
  await collection.open()
  const res = await collection.put({
    type: 'doc',
    value: { title: 'hello world' }
  })
  const res2 = await collection.put({
    type: 'fun',
    id: res.id,
    value: { color: 'red' }
  })
  // const id = res.id
  // await collection.sync()
  const results = await collection.query('records', { id: res.id }, { waitForSync: true })
  t.equal(results.length, 2)
  // t.equal(results[0].id, id)
  // t.equal(results[0].value.title, 'hello world')
  // console.log(results.map(record => record.get('title')))
  // console.log(results.map(record => record.address))
  // console.log(results.map(record => record.id))
  // console.log(results.map(record => record.fields().map(f => f.fieldAddress).join('  !!  ')))
  const record = results[0]
  // const record2 = results[1]
  const entity = collection.store.getEntity(record.id)
  // t.equal(record.entity.id, res.id)
  t.equal(entity.get('fun#color'), 'red')
  t.equal(entity.get('doc#title'), 'hello world')
  // t.equal(record.get('color'), 'red')
  // t.equal(record.get('fun#color'), 'red')
  // t.equal(record.get('fun#color'), 'red')
  // console.log(record.entity.getTypes().map(t => t.title))
  t.equal(entity.id, res.id)

  await cleanup()
  t.ok(true, 'cleanup ok')
})

tape('get and delete record', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('myCollection')
  await collection.putType({ name: 'foo', fields: { title: { type: 'string' } } })
  const nuRecord = {
    type: 'foo',
    id: 'bar',
    value: { title: 'bar' }
  }
  const res = await collection.put(nuRecord)
  const id = res.id
  const records = await collection.get({ id }, { waitForSync: true })
  t.equals(records.length, 1)
  await collection.del(nuRecord)
  const nuRecords = await collection.get({ id }, { waitForSync: true })
  t.equals(nuRecords.length, 0)

  await cleanup()
  t.ok(true, 'cleanup ok')
})

tape('batch stream', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.openCollection('default')
  const bs = await collection.createBatchStream()
  bs.write({ type: 'sonar/entity', value: { label: 'foo1' } })
  bs.write({ type: 'sonar/entity', value: { label: 'foo2' } })
  bs.write({ type: 'sonar/entity', value: { label: 'foo3' } })
  bs.end()
  await collection.sync()
  const res = await collection.query('records', { type: 'sonar/entity' }, { sync: true })
  t.deepEqual(res.map(r => r.value.label).sort(), ['foo1', 'foo2', 'foo3'])
  // const rows = []
  // for await (const row of bs) {
  //   rows.push(row)
  // }
  // t.deepEqual(rows.map(r => r.value.label), ['foo1', 'foo2', 'foo3'])
  await cleanup()
})

tape.skip('fs with strings', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('test')

  // with string
  await collection.fs.writeFile('/test/hello', 'world')
  const result = await collection.fs.readFile('/test/hello')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(result.toString(), 'world', 'string matches')
  await cleanup()
  t.ok(true, 'cleanup ok')
})

tape.skip('fs with buffers', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('test')

  // with buffer
  // const buf = Buffer.from(randomBytes(16))
  const buf = Buffer.from('hello')
  await collection.fs.writeFile('/test/bin', buf)
  const result = await collection.fs.readFile('/test/bin')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(buf.toString('hex'), result.toString('hex'), 'buffer matches')

  await cleanup()
  t.ok(true, 'cleanup ok')
})

// TODO: This test breaks CI.
// It causes the process to hang in the end.
tape.skip('fs with streams', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('test')

  // with stream
  const rs = new Readable({ read () {} })
  setTimeout(() => {
    rs.push('foo')
    rs.push('bar')
    rs.push(null)
  }, 50)
  await collection.fs.writeFile('/test/stream', rs)
  const result = await collection.fs.createReadStream('/test/stream')
  const chunks = await collect(result)
  t.equal(Buffer.concat(chunks).toString(), 'foobar', 'result matches')

  await cleanup()
})

tape('subscribe to record', async t => {
  const { client, cleanup } = await createOne({ network: false })
  const collection = await client.createCollection('foobar')
  await collection.putType({
    name: 'doc',
    fields: {
      title: {
        type: 'string'
      }
    }
  })
  const putted = await collection.put({
    type: 'doc',
    value: { title: 'hello world' }
  })

  let didNotify = false
  const notifyPromise = new Promise((resolve) => {
    putted.subscribe(record => {
      if (didNotify) t.fail('subscribe emitted more than once')
      t.equal(record.get('title'), 'hello moon', 'subscribe called correctly')
      didNotify = true
      resolve()
    })
  })

  const newVersion = putted.latest.update({
    title: 'hello moon'
  })
  await collection.put(newVersion)
  await notifyPromise

  await cleanup()
  t.ok(true, 'cleanup ok')
})

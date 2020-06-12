const tape = require('tape')
const { ServerClient } = require('./util/server')
const { Client } = require('..')
const randomBytes = require('randombytes')
const { promisify } = require('util')
const collect = promisify(require('stream-collector'))
const { Readable } = require('stream')

async function prepare (opts = {}) {
  opts.network = false
  const context = new ServerClient(opts)
  await context.createServer()
  const endpoint = `http://localhost:${context.port}/api`
  const client = new Client({ endpoint })
  return [context, client]
}

tape('db basic put and query', async t => {
  const [context, client] = await prepare()

  const collection = await client.createCollection('foobar')
  const res = await collection.put({
    schema: 'doc',
    value: { title: 'hello world' }
  })
  const id = res.id
  // await collection.sync()
  const results = await collection.query('records', { id }, { waitForSync: true })
  t.equal(results.length, 1)
  t.equal(results[0].id, id)
  t.equal(results[0].value.title, 'hello world')

  await context.stop()
})

tape('get and delete record', async t => {
  const [context, client] = await prepare()
  const collection = await client.createCollection('myCollection')
  const nuRecord = {
    schema: 'foo',
    id: 'bar',
    value: { title: 'bar' }
  }
  const res = await collection.put(nuRecord)
  console.log(res)
  const id = res.id
  const records = await collection.get({ id }, { waitForSync: true })
  t.equals(records.length, 1)
  await collection.del(nuRecord)
  const nuRecords = await collection.get({ id }, { waitForSync: true })
  t.equals(nuRecords.length, 0)

  await context.stop()
})

tape('fs with strings', async t => {
  const [context, client] = await prepare()
  const collection = await client.createCollection('test')

  // with string
  await collection.fs.writeFile('/test/hello', 'world')
  const result = await collection.fs.readFile('/test/hello')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(result.toString(), 'world', 'string matches')
  await context.stop()
})

tape('fs with buffers', async t => {
  const [context, client] = await prepare()
  const collection = await client.createCollection('test')

  // with buffer
  // const buf = Buffer.from(randomBytes(16))
  const buf = Buffer.from('hello')
  await collection.fs.writeFile('/test/bin', buf)
  const result = await collection.fs.readFile('/test/bin')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(buf.toString('hex'), result.toString('hex'), 'buffer matches')

  await context.stop()
})

tape('fs with streams', async t => {
  const [context, client] = await prepare()
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

  await context.stop()
})

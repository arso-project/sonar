const tape = require('tape')
const { Client } = require('..')
const randomBytes = require('randombytes')
const { promisify } = require('util')
const collect = promisify(require('stream-collector'))
const { Readable } = require('stream')

const { initDht, cleanupDht, BOOTSTRAP_ADDRESS } = require('./util/dht')
const { ServerClient } = require('./util/server')

async function prepare (opts = {}) {
  if (opts.network !== false) {
    await initDht()
    opts.network = true
    opts.bootstrap = BOOTSTRAP_ADDRESS
  }
  const context = new ServerClient(opts)
  await context.createServer()
  const endpoint = `http://localhost:${context.port}/api`
  const client = new Client({ endpoint })
  return [cleanup, client]
  async function cleanup () {
    await context.stop()
    await cleanupDht()
  }
}

tape('db basic put and query', async t => {
  const [cleanup, client] = await prepare({ network: false })

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

  await cleanup()
})

tape('fs with strings', async t => {
  const [cleanup, client] = await prepare({ network: false })
  const collection = await client.createCollection('test')

  // with string
  await collection.fs.writeFile('/test/hello', 'world')
  const result = await collection.fs.readFile('/test/hello')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(result.toString(), 'world', 'string matches')
  await cleanup()
})

tape('fs with buffers', async t => {
  const [cleanup, client] = await prepare()
  const collection = await client.createCollection('test')

  // with buffer
  // const buf = Buffer.from(randomBytes(16))
  const buf = Buffer.from('hello')
  await collection.fs.writeFile('/test/bin', buf)
  const result = await collection.fs.readFile('/test/bin')
  t.ok(Buffer.isBuffer(result), 'res is buffer')
  t.equal(buf.toString('hex'), result.toString('hex'), 'buffer matches')

  await cleanup()
})

tape('fs with streams', async t => {
  const [cleanup, client] = await prepare({ network: false })
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

tape('replicate resources', async t => {
  const [cleanup1, client1] = await prepare({ network: true })
  const [cleanup2, client2] = await prepare({ network: true })

  const collection1 = await client1.createCollection('first')
  const collection2 = await client2.createCollection('second', { key: collection1.key, alias: 'second' })

  t.equal(collection1.info.key, collection1.info.localKey)
  t.equal(collection2.info.key, collection1.info.key)
  t.notEqual(collection2.info.key, collection2.info.localKey)

  const resource1 = await writeResource(collection1, 'one', 'onfirst')
  const resource2 = await writeResource(collection2, 'two', 'onsecond')
  t.equal(resource1.key, collection1.info.key)
  t.equal(resource2.key, collection2.info.localKey)

  await timeout(200)

  let contents1 = await readResources(collection1)
  t.deepEqual(contents1.sort(), ['onfirst'], 'collection 1 ok')
  let contents2 = await readResources(collection2)
  t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')

  await collection1.addFeed(collection2.info.localKey, { alias: 'seconda' })

  await timeout(200)

  contents1 = await readResources(collection1)
  t.deepEqual(contents1.sort(), ['onfirst', 'onsecond'], 'collection 1 ok')
  contents2 = await readResources(collection2)
  t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')

  await Promise.all([cleanup1(), cleanup2()])
})

async function readResources (collection) {
  const records = await collection.query(
    'records',
    { schema: 'sonar/resource' },
    { waitForSync: true }
  )
  const contents = await Promise.all(records.map(r => {
    return collection.resources.readFile(r).then(c => c.toString())
  }))
  return contents
}

async function writeResource (collection, filename, content) {
  const resource = await collection.resources.create({ filename })
  await collection.resources.writeFile(resource, content)
  return resource
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const tape = require('tape')
const { promisify } = require('util')

const { createMany } = require('./lib/create')
tape('replicate resources', { timeout: 5000 }, async t => {
  const { cleanup, clients } = await createMany(2)
  const [client1, client2] = clients

  const collection1 = await client1.createCollection('first')
  const collection2 = await client2.createCollection('second', { key: collection1.key, alias: 'second' })

  t.equal(collection1.info.key, collection1.info.localKey)
  t.equal(collection2.info.key, collection1.info.key)
  t.notEqual(collection2.info.key, collection2.info.localKey)

  await writeResource(collection1, 'one', 'onfirst')

  // TODO: This refetches the schema. We should automate this.
  await collection2.open()

  await writeResource(collection2, 'two', 'onsecond')
  // t.equal(resource1.key, collection1.info.localKey, 'key of resource1 ok')
  // t.equal(resource2.key, collection2.info.localKey, 'key of resourc2 ok')

  // await timeout(500)

  let contents1 = await readResources(collection1)
  t.deepEqual(contents1.sort(), ['onfirst'], 'collection 1 ok')
  let contents2 = await readResources(collection2)
  t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')

  await collection1.addFeed(collection2.info.localKey, { alias: 'seconda' })
  await collection1.sync()

  contents1 = await readResources(collection1)
  t.deepEqual(contents1.sort(), ['onfirst', 'onsecond'], 'collection 1 ok')
  contents2 = await readResources(collection2)
  t.deepEqual(contents2.sort(), ['onfirst', 'onsecond'], 'collection 2 ok')

  await cleanup()
})

async function readResources (collection) {
  const records = await collection.query(
    'records',
    { type: 'sonar/resource' },
    { sync: true }
  )
  const contents = await Promise.all(records.map(r => {
    return collection.resources.readFile(r).then(c => c.toString())
  }))
  return contents
}

async function writeResource (collection, filename, content) {
  const url = '~me/' + filename
  await collection.fs.writeFile(url, content)
  // const resource = await collection.resources.create({ filename })
  // await collection.resources.writeFile(resource, content)
  // return resource
}

function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

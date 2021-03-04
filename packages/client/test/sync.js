const tape = require('tape')
const { createOne } = require('./lib/create')

tape('sync', async t => {
  const { client, cleanup } = await createOne()
  try {
    await client.putType('foo', { fields: { title: { type: 'string' } } })
    const { id } = await client.put({
      type: 'foo',
      id: 'bar',
      value: { title: 'bar' }
    })
    await client.sync()
    const records = await client.get({ id })
    t.equal(records.length, 1)
    t.equal(records[0].id, 'bar')
  } catch (err) {
    t.fail(err)
  }
  await cleanup()
})

tape('events', async t => {
  const { client, cleanup } = await createOne()
  try {
    const collection = await client.createCollection('test')
    const eventStream = collection.createEventStream()
    const events = []
    eventStream.on('data', event => {
      events.push(event)
    })
    await collection.putType({ name: 'foo', fields: { title: { type: 'string' } } })
    // console.log('type created')
    await collection.put({ type: 'foo', value: { title: 'hello world' } })
    // console.log('record created')
    await collection.sync()
    // Check that at least one schema-update and update event was received.
    const eventTypes = events.map(e => e.event)
    t.ok(eventTypes.indexOf('update') !== -1, 'update event received')
    t.ok(eventTypes.indexOf('schema-update') !== -1, 'schema update update event received')
  } catch (e) {
    console.log(e)
    throw e
  }
  await cleanup()
  t.end()
})

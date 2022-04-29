import tape from 'tape'
import { createOne } from './lib/create.js'
tape('sync', async (t) => {
  const { client, cleanup } = await createOne()
  const collection = await client.createCollection('sync')
  try {
    await collection.putType({
      name: 'foo',
      fields: {
        title: { type: 'string' }
      }
    })
    const { id } = await collection.put({
      type: 'foo',
      id: 'bar',
      value: { title: 'bar' }
    })
    await collection.sync()
    const records = await collection.get({ id })
    t.equal(records.length, 1)
    t.equal(records[0].id, 'bar')
  } catch (err) {
    t.fail(String(err))
  }
  await cleanup()
})
tape('events', async (t) => {
  const { client, cleanup } = await createOne()
  try {
    const collection = await client.createCollection('test')
    const eventStream = collection.createEventStream()
    const events: Array<any> = []
    eventStream.on('data', event => {
      events.push(event)
    })
    await collection.putType({
      name: 'foo',
      fields: { title: { type: 'string' } }
    })
    // console.log('type created')
    await collection.put({ type: 'foo', value: { title: 'hello world' } })
    // console.log('record created')
    await collection.sync()
    // Check that at least one schema-update and update event was received.
    const eventTypes = events.map(e => e.event)
    t.ok(eventTypes.includes('update'), 'update event received')
    t.ok(eventTypes.includes('schema-update'), 'schema update update event received')
  } catch (e) {
    console.log(e)
    throw e
  }
  await cleanup()
  t.end()
})

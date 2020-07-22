const tape = require('tape')
const createServerClient = require('./util/server')

tape('sync', async t => {
  const [context, client] = await createServerClient({ disableAuthentication: true })
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
  await context.stop()
})

tape.only('events', async t => {
  const [context, client] = await createServerClient({ disableAuthentication: true })
  try {
    const collection = await client.createCollection('test')
    const eventStream = collection.createEventStream()
    const events = []
    eventStream.on('data', event => {
      events.push(event)
      console.log('event', event)
    })
    await collection.putType({ name: 'foo', fields: { title: { type: 'string' } } })
    console.log('type created')
    await collection.put({ type: 'foo', value: { title: 'hello world' } })
    console.log('record created')
    await collection.sync()
    t.deepEqual(events.map(event => event.type).sort(), ['schema-update', 'update', 'update'])
  } catch (e) {
    console.log(e)
    throw e
  }
  await context.stop()
})

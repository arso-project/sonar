import tape from 'tape'
import { createMany } from './lib/create.js'

tape('put and del feed', async t => {
  const { cleanup, clients } = await createMany(2)
  const [client1, client2] = clients
  const collection1 = await client1.createCollection('first')
  const collection2 = await client2.createCollection('second')
  const record2 = await collection2.put({
    type: 'sonar/entity',
    value: { label: 'on2' }
  })
  const events = collection1.createEventStream()
  events.on('data', event => {
    console.log('collection1 event', event)
  })
  const feed2 = await collection1.putFeed(collection2.key!)
  console.log('putFeed done')
  // Wait until peers are found.
  // TODO: Maybe add a hook to wait for a peersFound event.
  await new Promise(resolve => setTimeout(resolve, 200))
  await collection1.sync()
  console.log('sync1 done')
  // TODO: Make core wait another sync when a feed is added.
  // console.log('sync2 done')
  let record2on1 = await collection1.get({ id: record2.id, type: record2.type })
  t.equal(record2on1[0].value.label, 'on2', 'record exists')
  await collection1.del(feed2)
  await collection1.reindex()
  let record2on1AfterDel = await collection1.get({
    id: record2.id,
    type: record2.type
  })
  t.equal(record2on1AfterDel.length, 0, 'record is deleted')
  await cleanup()
})

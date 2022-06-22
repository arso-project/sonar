import { Collection } from '..'
import tape from 'tape'
import { createMany } from './lib/create.js'

tape('peer events', async t => {
  const { cleanup, clients } = await createMany(3)
  const [client1, client2, client3] = clients
  const collection1 = await client1.createCollection('first')

  let events: any[] = []
  let notify: undefined | ((v?: any) => void) = undefined
  const eventStream = collection1.createEventStream()
  eventStream.on('data', event => {
    events.push(event)
    if (notify) notify()
  })
  async function expectEvent (type: string) {
    let timeout = setTimeout(() => {
      t.fail(`expected event "${type}" not received in timeout`)
    }, 1000)
    while (true) {
      if (!events.length) await new Promise(resolve => { notify = resolve })
      const event = events.shift()
      if (event.event !== type) continue
      clearTimeout(timeout)
      return event
    }
  }

  const collection2 = await client2.createCollection('second')
  const collection3 = await client3.createCollection('third')
  await collection1.putFeed(collection2.key!)
  await collection1.putFeed(collection3.key!)

  await collection1.updateInfo()

  let ev = await expectEvent('feed')
  t.equal(ev.data.key, collection2.key)
  ev = await expectEvent('peer-add')

  ev = await expectEvent('feed')
  t.equal(ev.data.key, collection3.key)
  ev = await expectEvent('peer-add')
  // console.log('after putFeed 2 and 3', collection1.info)
  await collection2.put({ type: 'sonar/entity', value: { label: 'on2' } })
  await collection3.put({ type: 'sonar/entity', value: { label: 'on3' } })

  await collection1.sync()
  await collection1.updateInfo()
  // console.log(
  //   'after putRecord 2 and 3',
  //   JSON.stringify(collection1.info!.peers, null, 2)
  // )

  const file = await collection3.files.createFile('fooo')
  await collection1.sync()
  await collection1.updateInfo()

  // console.log(
  //   'after createFile 3',
  //   JSON.stringify(collection1.info!.peers, null, 2)
  // )

  const fileContent = await collection1.files.readFile(file.id, {
    responseType: 'text'
  })
  t.equal(fileContent, 'fooo')

  ev = await expectEvent('feed')
  t.equal(ev.data.type, 'sonar.blobs')

  await collection1.updateInfo()

  // TODO: Test peer info.
  // console.log(
  //   'after readFile',
  //   JSON.stringify(collection1.info!.peers, null, 2)
  // )

  await cleanup()
})

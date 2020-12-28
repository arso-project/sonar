const { Workspace } = require('..')

const storagePath = process.env.STORAGE || '/tmp/sonar-demo'
const key = process.env.KEY
main(storagePath, key).catch(onerror)

async function main (storagePath, key) {
  const workspace = new Workspace({ storagePath })
  const keyOrName = key || 'default'
  await workspace.open()
  const collection = workspace.Collection(keyOrName)
  collection.use('debug', async records => {
    // console.log('map:batch', records)
  })
  console.log(collection)
  await collection.ready()
  // console.log('key: ' + collection.key.toString('hex'))
  console.log(collection)
  console.log(collection.rootFeed)
  console.log(collection.status())
  workspace.close()
  return
  await collection.putType({
    name: 'doc',
    // namespace: 'sonar',
    fields: { title: { type: 'string' } }
  })
  await collection.sync()
  await collection.put({
    type: 'doc',
    value: { title: 'hello' }
  })
  await collection.put({
    type: 'doc',
    value: { title: 'hi' }
  })
  await collection.sync()

  const qs = collection.createQueryStream('records', { type: 'doc' }, { live: true })
  qs.on('data', record => console.log('query', record))
  await new Promise(resolve => qs.once('end', resolve))

  // const res = await collection.query('records', { type: 'doc' })
  // console.log('query:res', res)

  // const sub = collection.subscribe('foo')
  // setTimeout(() => console.log('end'), 100000)
  // for await (const record of sub.stream()) {
  //   console.log('RECORD', record.get('title'), record.key.toString('hex'))
  // }
  //
  // const res = await collection.query('records', {
  //   type: 'sonar.doc'
  // })
  // console.log(res)
}

function onerror (err) {
  console.error(err)
  process.exit(1)
}

const tape = require('tape')
const createServerClient = require('./util/server')

tape('sync', async t => {
  const [context, client] = await createServerClient()
  const { id } = await client.put({
    schema: 'foo',
    id: 'bar',
    value: { title: 'bar' }
  })
  await client.sync()
  const records = await client.get({ id })
  t.equal(records.length, 1)
  t.equal(records[0].id, 'bar')
  await context.stop()
})

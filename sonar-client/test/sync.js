const tape = require('tape')
const createServerClient = require('./util/server')

tape('sync', async t => {
  const [context, client] = await createServerClient()
  try {
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

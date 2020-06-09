const tape = require('tape')
const { ServerClient } = require('../util/server')
const { NewClient: Client } = require('../..')

async function prepare (opts = {}) {
  opts.network = false
  const context = new ServerClient(opts)
  await context.createServer()
  const endpoint = `http://localhost:${context.port}/api`
  const client = new Client({ endpoint })
  return [context, client]
}

tape.only('basic', async t => {
  const [context, client] = await prepare()

  const island = await client.createIsland('foobar')
  const res = await island.put({
    schema: 'doc',
    value: { title: 'hello world' }
  })
  const id = res.id
  // await island.sync()
  const results = await island.query('records', { id }, { waitForSync: true })
  t.equal(results.length, 1)
  t.equal(results[0].id, id)
  t.equal(results[0].value.title, 'hello world')

  await context.stop()
})

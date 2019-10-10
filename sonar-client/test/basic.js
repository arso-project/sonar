const test = require('tape-plus')
require('axios-debug-log')

const { makeServer } = require('./util/server')
const SonarClient = require('..')

test('basics', async t => {
  const port = 21212
  const islandName = 'foo'

  const cleanup = await makeServer({ port })
  try {
    const client = new SonarClient(`http://localhost:${port}/api`, islandName)

    await client.create(islandName)
    await client.put({ schema: 'doc', value: { title: 'hello world' } })
    await client.put({ schema: 'doc', value: { title: 'hello moon' } })
    await new Promise(resolve => setTimeout(resolve, 500))
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
  } catch (e) {
    t.error(e)
  }

  await cleanup()
})

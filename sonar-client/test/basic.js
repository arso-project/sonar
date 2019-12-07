const test = require('tape')
require('axios-debug-log')

const { makeClient } = require('./util/server')

async function prepare () {
  const port = 21212
  const island = 'foo'
  let [client, cleanup] = await makeClient({ port, island })
  await client.createIsland(island)
  await client.put({ schema: 'doc', value: { title: 'hello world' } })
  await client.put({ schema: 'doc', value: { title: 'hello moon' } })
  await new Promise(resolve => setTimeout(resolve, 300))
  return [client, cleanup]
}

test('basic query', async t => {
  const [client, cleanup] = await prepare()
  let results = await client.search('hello')
  t.equal(results.length, 2, 'hello search')
  results = await client.search('world')
  t.equal(results.length, 1, 'world search')
  results = await client.search('moon')
  t.equal(results.length, 1, 'moon search')
  await cleanup()
  t.end()
})

test('toshi query', async t => {
  const [client, cleanup] = await prepare()
  let results = await client.search({
    query: { bool: { must: [ { term: { title: 'hello' } } ], must_not: [ { term: { title: 'moon' } } ] } }, limit: 10 }
  )
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  await cleanup()
  t.end()
})

const test = require('tape')
require('axios-debug-log')

const { SearchQueryBuilder } = require('..')
const ServerClient = require('./util/server')

async function prepare (t) {
  const island = 'foo'
  const run = new ServerClient(t, { island })
  const client = await run.start()

  await client.createIsland(island)
  await client.put({ schema: 'doc', value: { title: 'hello world' } })
  await client.put({ schema: 'doc', value: { title: 'hello moon' } })
  // TODO: await client.sync()
  await new Promise(resolve => setTimeout(resolve, 500))

  return [run, client]
}

test('basic query', async t => {
  const [run, client] = await prepare(t)
  try {
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
  } catch (err) {
    t.fail(err)
  }
  await run.stop()
})

test('querybuilder: simple bool search', async t => {
  const [run, client] = await prepare(t)
  try {
    const query = new SearchQueryBuilder('doc')
    query
      .bool('must', [query.term('title', 'hello')])
      .bool('must_not', [query.term('title', 'moon')])
      .limit(10)
    const results = await client.search(query)
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  } catch (err) {
    t.fail(err)
  }
  await run.stop()
})

// TODO: Test query for all documents
// TODO: Test range query
// TODO: Test regex query
// TODO: Test facet query
// TODO: Test exact query
// TODO: Test fuzzy query
// TODO: Test phrase query
test('querybuilder: phrase search', async t => {
  const [run, client] = await prepare(t)
  try {
    const query = new SearchQueryBuilder('doc')
    query.phrase('title', ['hello', 'moon'])
    const results = await client.search(query)
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello moon', 'phrase search worked')
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
  await run.stop()
})

test('toshi query', async t => {
  const [run, client] = await prepare(t)
  try {
    const results = await client.search({
      query: { bool: { must: [{ term: { title: 'hello' } }], must_not: [{ term: { title: 'moon' } }] } }, limit: 10
    })
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
  await run.stop()
})

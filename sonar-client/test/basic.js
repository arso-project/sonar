const { group } = require('tape-plus')
require('axios-debug-log')

const { makeServer } = require('./util/server')
const { SonarClient, QueryBuilder } = require('..')

group('basics', test => {
  const port = 21212
  const islandName = 'foo'
  let cleanup
  let client

  test.beforeEach(async t => {
    cleanup = await makeServer({ port })
    client = new SonarClient(`http://localhost:${port}/api`, islandName)

    await client.create(islandName)
    await client.put({ schema: 'doc', value: { title: 'hello world' } })
    await client.put({ schema: 'doc', value: { title: 'hello moon' } })
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  test.afterEach(async t => {
    await cleanup()
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  test('basic query', async t => {
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
  })

  test('toshi query', async t => {
    let results = await client.search({ 
      query: {bool: {must: [ { term: { title: "hello" } } ], must_not: [ {term: {title: "moon" } } ] } }, limit: 10 }
    )
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  })

  test('query builder', async t => {
    const query = new QueryBuilder('doc')
    query
      .bool('must', [query.term('title', 'hello')])
      .bool('must_not', [query.term('title', 'moon')])
      .limit(10)
    let results = await client.search(query)
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  })


})

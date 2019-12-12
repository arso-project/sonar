const test = require('tape')
require('axios-debug-log')

const {QueryBuilder} = require('..')
const {makeClient} = require('./util/server')

async function prepare(t) {
  const port = 21212
  const island = 'foo'
  let [client, cleanup] = await makeClient({port, island})
  await client.createIsland(island)
  // const key = res.key
  await client.put({schema: 'doc', value: {title: 'hello world'}})
  await client.put({schema: 'doc', value: {title: 'hello moon'}})
  await new Promise(resolve => setTimeout(resolve, 500))
  return [client, cleanup]
}

test('basic query', async t => {
  try {
    const [client, cleanup] = await prepare(t)
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
    await cleanup()
    t.end()
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
})

test('querybuilder: simple bool search', async t => {
  try {
    const [client, cleanup] = await prepare(t)
    const query = new QueryBuilder('doc')
    query
      .bool('must', [query.term('title', 'hello')])
      .bool('must_not', [query.term('title', 'moon')])
      .limit(10)
    let results = await client.search(query)
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
    await cleanup()
    t.end()
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
})

// TODO: Test query for all documents
// TODO: Test range query
// TODO: Test regex query
// TODO: Test facet query
// TODO: Test exact query
// TODO: Test fuzzy query
// TODO: Test phrase query
test('querybuilder: phrase search', async t => {
  try {
    const [client, cleanup] = await prepare(t)
    const query = new QueryBuilder('doc')
    query.phrase('title', ['hello', 'moon'])
    //console.log(query.getQuery())
    let results = await client.search({limit: 10, query: {phrase: {title: {terms: ['hello', 'moon']}}}})
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello moon', 'phrase search worked')
    await cleanup()
    t.end()
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
})


test('toshi query', async t => {
  try {
    const [client, cleanup] = await prepare(t)
    let results = await client.search({
      query: {bool: {must: [{term: {title: 'hello'}}], must_not: [{term: {title: 'moon'}}]}}, limit: 10
    })
    t.equal(results.length, 1, 'should return one result')
    t.equal(results[0].value.title, 'hello world', 'toshi query worked')
    await cleanup()
    t.end()
  } catch (err) {
    console.log(err.toString())
    t.error(err)
  }
})

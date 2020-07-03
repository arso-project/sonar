const test = require('tape')

const { SearchQueryBuilder } = require('..')
const createServerClient = require('./util/server')

async function prepare (t) {
  const [context, client] = await createServerClient()
  try {
    await client.put({ type: 'doc', value: { title: 'hello world' } })
    await client.put({ type: 'doc', value: { title: 'hello moon' } })
    await client.sync()
  } catch (e) {
    t.fail(e)
    await context.stop()
    throw e
  }

  return [context, client]
}

test('basic query', async t => {
  const [context, client] = await prepare(t)
  let results = await client.search('hello')
  t.equal(results.length, 2, 'hello search')
  results = await client.search('world')
  t.equal(results.length, 1, 'world search')
  results = await client.search('moon')
  t.equal(results.length, 1, 'moon search')
  await context.stop()
})

test('querybuilder: simple bool search', async t => {
  const [context, client] = await prepare(t)
  const query = new SearchQueryBuilder('doc')
  query
    .bool('must', [query.term('title', 'hello')])
    .bool('must_not', [query.term('title', 'moon')])
    .limit(10)

  const results = await client.query('search', query, { waitForSync: true })
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  await context.stop()
  t.end()
})

// TODO: Test query for all documents
// TODO: Test range query
// TODO: Test regex query
// TODO: Test facet query
// TODO: Test exact query
// TODO: Test fuzzy query
// TODO: Test phrase query
test('querybuilder: phrase search', async t => {
  const [context, client] = await prepare(t)
  const query = new SearchQueryBuilder('doc')
  query.phrase('title', ['hello', 'moon'])
  const results = await client.query(
    'search',
    query,
    { waitForSync: true }
  )
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello moon', 'phrase search worked')
  await context.stop()
})

test('toshi query', async t => {
  const [context, client] = await prepare(t)
  const results = await client.search({
    query: {
      bool: {
        must: [{
          term: { title: 'hello' }
        }],
        must_not: [{
          term: { title: 'moon' }
        }]
      }
    },
    limit: 10
  })
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  await context.stop()
  t.end()
})

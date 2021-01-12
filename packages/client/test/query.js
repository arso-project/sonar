const test = require('tape')

const { SearchQueryBuilder } = require('..')
const { createOne } = require('./lib/create')

async function prepare (t) {
  const { client, cleanup } = await createOne()
  try {
    await client.putType('doc', { fields: { title: { type: 'string' } } })
    await client.put({ type: 'doc', value: { title: 'hello world' } })
    await client.put({ type: 'doc', value: { title: 'hello moon' } })
    await client.sync()
  } catch (e) {
    console.error(e)
    t.fail(e)
    await cleanup()
    throw e
  }

  return { client, cleanup }
}

test('basic query', async t => {
  try {
    const { client, cleanup } = await prepare(t)
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
    await cleanup()
  } catch (e) {
    console.error('error', e)
  }
})

test('querybuilder: simple bool search', async t => {
  const { client, cleanup } = await prepare(t)
  const query = new SearchQueryBuilder('doc')
  query
    .bool('must', [query.term('title', 'hello')])
    .bool('must_not', [query.term('title', 'moon')])
    .limit(10)

  const results = await client.query('search', query, { waitForSync: true })
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello world', 'toshi query worked')
  await cleanup()
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
  const { client, cleanup } = await prepare(t)
  const query = new SearchQueryBuilder('doc')
  query.phrase('title', ['hello', 'moon'])
  const results = await client.query(
    'search',
    query,
    { waitForSync: true }
  )
  t.equal(results.length, 1, 'should return one result')
  t.equal(results[0].value.title, 'hello moon', 'phrase search worked')
  await cleanup()
})

test('toshi query', async t => {
  const { client, cleanup } = await prepare(t)
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
  await cleanup()
  t.end()
})

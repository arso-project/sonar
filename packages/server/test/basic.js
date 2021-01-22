const fetch = require('isomorphic-fetch')
const { createOne } = require('./lib/create')
const tape = require('tape')

tape('basic', async t => {
  try {
    const opts = {
      persist: false,
      // network: false,
      workspace: {
        defaultViews: false
      }
    }
    const { endpoint, cleanup } = await createOne(opts)

    const created = await fetchJSON(`${endpoint}/collection`, {
      method: 'POST',
      body: JSON.stringify({ name: 'test' })
    })
    const { key } = created
    t.ok(key.match(/^[a-h0-9]{64}$/), 'key is 32 byte hex string')

    const collection = await fetchJSON(`${endpoint}/collection/${key}`)
    t.equal(collection.key, key, 'get collection: key correct')
    t.equal(collection.rootKey, key, 'get collection: root key correct')
    // console.log('collection', collection)

    const putted = await fetchJSON(`${endpoint}/collection/${key}/db`, {
      method: 'PUT',
      body: JSON.stringify({ type: 'sonar/entity', value: { label: 'hello, world' } })
    })
    // console.log('put', putted)

    const queried = await fetchJSON(`${endpoint}/collection/${key}/query/records?sync=1`, {
      method: 'POST',
      body: JSON.stringify({ id: putted.id })
    })
    // console.log('query', queried)
    t.ok(Array.isArray(queried), 'query result is array')
    t.equal(queried.length, 1, 'query length 1')
    t.equal(putted.id, queried[0].id, 'query id matches put')

    await cleanup()
  } catch (err) {
    console.error(err)
    t.fail(err)
  }
})

async function fetchJSON (url, opts = {}) {
  opts.headers = opts.headers || {}
  opts.headers['content-type'] = 'application/json'
  return fetch(url, opts).then(r => r.json())
}

const tape = require('tape')
const { runAll } = require('./lib/util')

// TODO: Remove.
const createStore = require('./lib/create')

const { createOne } = require('./lib/create')

tape('open close', async t => {
  const { cleanup, workspace } = await createOne()
  t.true(workspace.opened, 'opened property is set')
  await cleanup()
})

tape('put and get 1', async t => {
  const { cleanup, workspace } = await createOne()
  const collection = await workspace.openCollection('default')
  await collection.putType({ name: 'doc', fields: { title: { type: 'string' } } })
  const record = await collection.put({ type: 'doc', value: { title: 'hello' } })
  t.equal(record.value.title, 'hello')
  const id = record.id
  const records = await collection.query('records', { id }, { sync: true })
  t.equal(records.length, 1)
  t.equal(records[0].value.title, 'hello')
  await cleanup()
})

tape('batch and query', async t => {
  const { cleanup, workspace } = await createOne()
  const collection = await workspace.openCollection('first')
  const records = [
    { title: 'Hello world', body: 'so rough' },
    { title: 'Hello moon', body: 'so dark' }
  ]
  await collection.putType({ name: 'doc', fields: { title: { type: 'string', body: { type: 'String' } } } })
  const batch = records.map(value => ({ op: 'put', type: 'doc', value }))
  await collection.batch(batch)
  await collection.sync()
  let res = await collection.query('search', 'hello', { sync: true })
  t.equal(res.length, 2, 'hello search')
  let titles = res.map(r => r.value.title).sort()
  t.deepEqual(titles, ['Hello moon', 'Hello world'], 'hello results ok')
  res = await collection.query('search', 'moon')
  t.equal(res.length, 1, 'moon search')
  titles = res.map(r => r.value.title).sort()
  t.deepEqual(titles, ['Hello moon'], 'moon results ok')
  res = await collection.query('records', { type: 'doc' })
  t.equal(res.length, 2)
  await cleanup()
})

tape('share and unshare workspace', t => {
  createStore({ network: true }, (err, workspace, cleanup) => {
    t.error(err, 'tempdir ok')
    workspace.create('collection', (err, collection) => {
      t.error(err, 'collection created')
      const hkey = collection.key.toString('hex')
      const config = workspace.getCollectionConfig(hkey)
      t.true(config, 'collection config exists')
      t.true(config.share, 'collection config init shared')
      const status = workspace.network.status(collection.discoveryKey)
      t.equal(status.announce, true, 'collection network init shared')
      t.equal(status.lookup, true, 'collection network init shared')
      workspace.updateCollection(hkey, { share: false }, (err) => {
        t.error(err, 'no error at update')
        const config = workspace.getCollectionConfig(hkey)
        t.equal(config.share, false, 'collection updated config not shared')
        const status = workspace.network.status(collection.discoveryKey)
        t.false(status, 'collection updated network not shared')
        cleanup(err => {
          t.error(err)
          t.end()
        })
      })
    })
  })
})

tape('close collection', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    t.error(err, 'tempdir ok')
    workspace.create('collection', (err, collection) => {
      t.error(err, 'collection created')
      t.true(collection.opened, 'opened property set')
      collection.close(err => {
        t.error(err, 'collection closed')
        t.true(collection.closed, 'closed property set')
        cleanup(err => {
          t.error(err)
          t.end()
        })
      })
    })
  })
})

// TODO: This behavior was removed in the recent refactor - creating a collection
// more than once does not fail but just returns the same collection.
tape.skip('create collection with same name', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    t.error(err)
    runAll([
      next => {
        workspace.create('first', (err, collection) => {
          t.error(err, 'no error for first collection')
          next()
        })
      },
      next => {
        workspace.create('first', (err, collection) => {
          t.ok(err, 'error with same name')
          t.equal(err.message, 'collection exists', 'correct error message')
          next()
        })
      },
      next => cleanup(next),
      next => t.end()
    ])
  })
})

tape('query empty collection', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    t.error(err)
    workspace.create('collection', (err, collection) => {
      t.error(err)
      collection.query('search', 'anything', { waitForSync: true }, (err, res) => {
        t.error(err, 'query on empty collection')
        t.deepEquals(res, [], 'empty result')
        cleanup(err => {
          t.error(err)
          t.end()
        })
      })
    })
  })
})

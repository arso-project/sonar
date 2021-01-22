const tape = require('tape')
const { runAll } = require('./lib/util')

const createStore = require('./lib/create')

tape('open close', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    if (err) t.fail(err)
    t.true(workspace.opened, 'opened property is set')
    t.error(err)
    cleanup(err => {
      t.error(err)
      t.end()
    })
  })
})

tape('batch and query', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    t.error(err, 'tempdir ok')
    workspace.create('first', (err, collection) => {
      t.error(err, 'collection created')

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      collection.schema.addType({
        name: 'doc',
        fields: {
          title: { type: 'string' },
          body: { type: 'String' }
        }
      })

      runAll([
        next => {
          const batch = records.map(value => ({ op: 'put', type: 'doc', value }))
          // console.log('put batch')
          collection.batch(batch, (err, res) => {
            // console.log('did put batch')
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            next()
          })
        },
        next => {
          collection.query('search', 'hello', { waitForSync: true }, (err, res) => {
            t.error(err)
            t.equal(res.length, 2, 'hello search')
            // console.log(res)
            const titles = res.map(r => r.value.title).sort()
            t.deepEqual(titles, ['Hello moon', 'Hello world'], 'hello results ok')
            next(err)
          })
        },
        next => {
          collection.query('search', 'moon', (err, res) => {
            t.error(err)
            t.equal(res.length, 1, 'moon search')
            const titles = res.map(r => r.value.title).sort()
            t.deepEqual(titles, ['Hello moon'], 'moon results ok')
            next()
          })
        },
        next => {
          collection.query('records', { type: 'doc' }, (err, res) => {
            t.error(err)
            t.equal(res.length, 2)
            next()
          })
        },
        next => cleanup(next)
      ]).catch(err => t.fail(err)).then(() => t.end())
    })
  })
})

tape('put and get 1', t => {
  createStore({ network: false }, (err, workspace, cleanup) => {
    t.error(err, 'tempdir ok')
    workspace.create('default', (err, collection) => {
      t.error(err)
      collection.putType({ name: 'doc', fields: { title: { type: 'string' } } }, err => {
        t.error(err)
        collection.put({ type: 'doc', value: { title: 'hello' } }, (err, record) => {
          t.error(err)
          const id = record.id
          collection.query('records', { id }, { waitForSync: true }, (err, records) => {
            t.error(err)
            t.equal(records.length, 1)
            t.equal(records[0].value.title, 'hello')
            cleanup(() => t.end())
          })
        })
      })
    })
  })
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

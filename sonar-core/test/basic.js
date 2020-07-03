const tape = require('tape')
const tmp = require('temporary-directory')
const { runAll } = require('./lib/util')

const { CollectionStore } = require('..')

function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const collections = new CollectionStore(dir, opts)
    collections.ready(err => {
      if (err) return cb(err)
      cb(null, collections, cleanup)
    })
    function cleanup (cb) {
      collections.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
    }
  }
}

tape('open close', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.true(collections.opened, 'opened property is set')
    t.error(err)
    cleanup(err => {
      t.error(err)
      t.end()
    })
  })
})

tape('batch and query', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    collections.create('first', (err, collection) => {
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
          collection.batch(batch, (err, res) => {
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            next()
          })
        },
        next => {
          collection.query('search', 'hello', { waitForSync: true }, (err, res) => {
            t.error(err)
            t.equal(res.length, 2, 'hello search')
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
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    collections.create('default', (err, collection) => {
      t.error(err)
      // collection.status((err, status) => {
      //   console.log('STATUS', err, status)
      //   t.end()
      // })
      collection.put({ type: 'doc', value: { title: 'hello' } }, (err, id) => {
        t.error(err)
        collection.get({ id }, { waitForSync: true }, (err, records) => {
          t.error(err)
          t.equal(records.length, 1)
          t.equal(records[0].value.title, 'hello')
          cleanup(() => t.end())
        })
      })
    })
  })
})

tape('put and get 2', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    collections.create('default', (err, collection) => {
      t.error(err)
      collection.put({ type: 'doc', value: { title: 'hello' } }, (err, id) => {
        t.error(err)
        collection.get({ id }, { waitForSync: true }, (err, records) => {
          t.error(err)
          t.equal(records.length, 1)
          t.equal(records[0].value.title, 'hello')
          cleanup(() => t.end())
        })
      })
    })
  })
})

tape('share and unshare collections', t => {
  createStore({ network: true }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    collections.create('collection', (err, collection) => {
      t.error(err, 'collection created')
      const hkey = collection.key.toString('hex')
      const config = collections.getCollectionConfig(hkey)
      t.true(config, 'collection config exists')
      t.true(config.share, 'collection config init shared')
      const status = collections.network.status(collection.discoveryKey)
      t.equal(status.announce, true, 'collection network init shared')
      t.equal(status.lookup, true, 'collection network init shared')
      collections.updateCollection(hkey, { share: false }, (err) => {
        t.error(err, 'no error at update')
        const config = collections.getCollectionConfig(hkey)
        t.equal(config.share, false, 'collection updated config not shared')
        const status = collections.network.status(collection.discoveryKey)
        t.equal(status, null, 'collection updated network not shared')
        cleanup(err => {
          t.error(err)
          t.end()
        })
      })
    })
  })
})

tape('close collection', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    collections.create('collection', (err, collection) => {
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

tape('create collection with same name', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err)
    runAll([
      next => {
        collections.create('first', (err, collection) => {
          t.error(err, 'no error for first collection')
          next()
        })
      },
      next => {
        collections.create('first', (err, collection) => {
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
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err)
    collections.create('collection', (err, collection) => {
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

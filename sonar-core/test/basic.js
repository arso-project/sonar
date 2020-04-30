const tape = require('tape')
const tmp = require('temporary-directory')
const { runAll } = require('./lib/util')

const { IslandStore } = require('..')

function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const islands = new IslandStore(dir, opts)
    islands.ready(err => {
      if (err) return cb(err)
      cb(null, islands, cleanup)
    })
    function cleanup (cb) {
      islands.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
    }
  }
}

tape('open close', t => {
  createStore({ network: false }, (err, islands, cleanup) => {
    t.true(islands.opened, 'opened property is set')
    t.error(err)
    cleanup(err => {
      t.error(err)
      t.end()
    })
  })
})

tape('batch and query', t => {
  createStore({ network: false }, (err, islands, cleanup) => {
    t.error(err, 'tempdir ok')
    islands.create('first', (err, island) => {
      t.error(err, 'island created')

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      runAll([
        next => {
          const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
          island.batch(batch, (err, res) => {
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            next()
          })
        },
        // FRANZ: i often get Child process died error when querying
        // next => {
        //   island.query('search', 'hello', { waitForSync: true }, (err, res) => {
        //     t.error(err)
        //     t.equal(res.length, 2, 'hello search')
        //     const titles = res.map(r => r.value.title).sort()
        //     t.deepEqual(titles, ['Hello moon', 'Hello world'], 'hello results ok')
        //     next(err)
        //   })
        // },
        // next => {
        //   island.query('search', 'moon', (err, res) => {
        //     t.error(err)
        //     t.equal(res.length, 1, 'moon search')
        //     const titles = res.map(r => r.value.title).sort()
        //     t.deepEqual(titles, ['Hello moon'], 'moon results ok')
        //     next()
        //   })
        // },
        // next => {
        //   island.query('records', { schema: 'doc' }, (err, res) => {
        //     t.error(err)
        //     t.equal(res.length, 2)
        //     next()
        //   })
        // },
        next => cleanup(next)
      ]).catch(err => t.fail(err)).then(() => t.end())
    })
  })
})

tape('share and unshare islands, no network', t => {
  createStore({ network: false }, (err, islands, cleanup) => {
    t.error(err, 'tempdir ok')
    islands.create('ExIsland', (err, island) => {
      t.error(err, 'island created')
      // did not manage to access hex function from store, neither
      // from here, nor from store  -> FRANZ
      const keyStr = island.key.toString('hex')
      var firstIslandConfig = islands.getIslandConfig(keyStr)
      t.true(firstIslandConfig, 'island config exists')
      t.true(firstIslandConfig.share, 'island initially shared')
      islands.unshare(island.key)
      firstIslandConfig = islands.getIslandConfig(keyStr)
      // next line throws exception. change unshare function? -> FRANZ
      // t.false(firstIslandConfig.share, 'island unshared')
      cleanup(err => {
        t.error(err)
        t.end()
      })
    })
  })
})

// not sure what exactly should happen. anything yet?
// what makes sense to test here?
tape('share and unshare islands with network', t => {
  createStore({ network: true }, (err, islands, cleanup) => {
    t.error(err, 'tempdir ok')
    islands.create('ExIsland', (err, island) => {
      t.error(err, 'island created')
      // did not manage to access hex function from store, neither
      // from here, nor from store  -> FRANZ
      const keyStr = island.key.toString('hex')
      var firstIslandConfig = islands.getIslandConfig(keyStr)
      t.true(firstIslandConfig, 'island config exists')
      t.true(firstIslandConfig.share, 'island initially shared')
      islands.unshare(island.key)
      firstIslandConfig = islands.getIslandConfig(keyStr)
      // next line throws exception. change unshare function? -> FRANZ
      // t.false(firstIslandConfig.share, 'island unshared')
      cleanup(err => {
        t.error(err)
        t.end()
      })
    })
  })
})

tape('three islands', t => {
  createStore({ network: false }, (err, islands, cleanup) => {
    t.error(err, 'tempdir ok')
    const records = [
      { title: 'Hello world', body: 'so rough' },
      { title: 'Hello moon', body: 'so dark' }
    ]
    const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
    runAll([
      next => {
        islands.create('first', (err, island) => {
          t.error(err, 'first island created')
          island.batch(batch, (err, res) => {
            t.error(err, 'first batch ok')
            t.equal(res.length, 2)
            next()
          })
        })
      },
      next => {
        islands.create('second', (err, island) => {
          t.error(err, 'second island created')
          t.equals(Object.values(islands.islands).length, 2, '2 islands in store')
          island.batch(batch, (err, res) => {
            t.error(err, 'second batch ok')
            t.equal(res.length, 2)
            next()
          })
        })
      },
      next => {
        islands.create('third', (err, island) => {
          t.error(err, 'third island created')
          t.equals(Object.values(islands.islands).length, 3, '3 islands in store')
          var thirdStatus = island.status()
          t.true(thirdStatus.opened, 'island opened')
          island.close(err => {
            t.error(err, 'closed island')
            thirdStatus = island.status()
            // the next line is not correct. should it be? -> FRANZ
            // t.false(thirdStatus.opened, 'island closed')
          })
          // islands.get('first', (err, firstIsland) => {
          //   t.error(err, 'found first island')
          //   firstIsland.query('search', 'WORLD', { waitForSync: true }, (err, res) => {
          //     t.error(err, 'query first island')
          //     t.equal(res.length, 1, 'world search ok')
          //     const titles = res.map(r => r.value.title).sort()
          //     t.deepEqual(titles, ['Hello world'], 'world results ok')
          //     next(err)
          //   })
          // })
          // ask franz why the callback is never called in this case
          // and how to test for that)
          // islands.get('third', (err, thirdIsland) => {
          //   t.error(err, 'found third island')
          //   thirdIsland.query('search', 'world', { waitForSync: true }, (err, res) => {
          //     t.error(err, 'query on third island')
          //     console.log('it is happening')
          //   })
          // })
          next()
        })
      },
      next => cleanup(next)
    ]).catch(err => t.fail(err)).then(() => t.end())
  })
})

/*
tried to test exception throwing when two island with
the same name are created. Doesn't work -> ask franz
*/
// tape('createIslandsSameName', t => {
//   createStore({ network: false }, (err, islands, cleanup) => {
//     t.error(err, 'tempdir ok')
//     function createSameIsland () {
//       islands.create('sameName', (err, island) => {
//         if (err) {
//           console.log(err)
//           return (err, null)
//         }
//         return (null, island)
//       })
//     }
//     runAll([
//       next => {
//         t.doesNotThrow(createSameIsland)
//         next()
//       },
//       next => {
//         t.throws(createSameIsland)
//         next(err)
//       },
//       next => cleanup(next)
//     ]).catch(err => t.fail(err)).then(() => t.end())
//   })
// })

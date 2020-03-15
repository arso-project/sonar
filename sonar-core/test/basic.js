const tape = require('tape')
const tmp = require('temporary-directory')
const { runAll } = require('./lib/util')

const { GroupStore } = require('..')

function createStore (opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  tmp('sonar-test', ondircreated)
  function ondircreated (err, dir, cleanupTempdir) {
    if (err) return cb(err)
    const groups = new GroupStore(dir, opts)
    groups.ready(err => {
      if (err) return cb(err)
      cb(null, groups, cleanup)
    })
    function cleanup (cb) {
      groups.close(() => {
        cleanupTempdir(err => {
          cb(err)
        })
      })
    }
  }
}

tape('open close', t => {
  createStore({ network: false }, (err, groups, cleanup) => {
    t.true(groups.opened, 'opened property is set')
    t.error(err)
    cleanup(err => {
      t.error(err)
      t.end()
    })
  })
})

tape('batch and query', t => {
  createStore({ network: false }, (err, groups, cleanup) => {
    t.error(err, 'tempdir ok')
    groups.create('first', (err, group) => {
      t.error(err, 'group created')

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      runAll([
        next => {
          const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
          group.batch(batch, (err, res) => {
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            next()
          })
        },
        next => {
          group.query('search', 'hello', { waitForSync: true }, (err, res) => {
            t.error(err)
            t.equal(res.length, 2, 'hello search')
            const titles = res.map(r => r.value.title).sort()
            t.deepEqual(titles, ['Hello moon', 'Hello world'], 'hello results ok')
            next(err)
          })
        },
        next => {
          group.query('search', 'moon', (err, res) => {
            t.error(err)
            t.equal(res.length, 1, 'moon search')
            const titles = res.map(r => r.value.title).sort()
            t.deepEqual(titles, ['Hello moon'], 'moon results ok')
            next()
          })
        },
        next => {
          group.query('records', { schema: 'doc' }, (err, res) => {
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

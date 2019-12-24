const tape = require('tape')
const tmp = require('temporary-directory')
const { runAll } = require('./lib/util')

const { IslandStore } = require('..')

function prepare (t, cb) {
  tmp((err, dir, tmpCleanup) => {
    if (err) return cb(err)
    const islands = new IslandStore(dir)
    islands.ready(() => {
      cb(null, islands, cleanup)
    })
    function cleanup (cb) {
      islands.close(() => {
        tmpCleanup(err => {
          t.error(err)
          t.end()
        })
      })
    }
  })
}

tape('basic', t => {
  prepare(t, (err, islands, cleanup) => {
    t.error(err, 'tempdir ok')
    islands.create('first', (err, island) => {
      t.error(err, 'island created')

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      runAll([
        cb => {
          const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
          island.db.batch(batch, (err, res) => {
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            cb()
          })
        },
        // TODO: Remove timeout!
        // cb => setTimeout(cb, 100),
        cb => setImmediate(() => island.db.kappa.ready('search', cb)),
        cb => {
          island.query('search', 'hello', { load: false }, (err, res) => {
            t.equal(res.length, 2, 'hello search')
            cb(err)
          })
        },
        cb => {
          island.query('search', 'moon', { load: false }, (err, res) => {
            t.equal(res.length, 1, 'moon search')
            cb(err)
          })
        },
        cb => cleanup(cb)
      ]).catch(err => t.fail(err)).then(() => t.end())
    })
  })
})

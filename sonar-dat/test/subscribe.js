const tape = require('tape')
const tmp = require('temporary-directory')
const collect = require('stream-collector')
const { runAll } = require('./lib/util')

const { IslandStore } = require('..')

function prepare (t, cb) {
  tmp((err, dir, tmpCleanup) => {
    if (err) return cb(err)
    const islands = new IslandStore(dir)
    return cb(null, islands, cleanup)
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

tape.only('pubsub', t => {
  prepare(t, (err, islands, cleanup) => {
    islands.create('first', (err, island) => {
      t.error(err, 'island created')

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      runAll([
        cb => {
          const batch = records.map(value => ({ op: 'put', schema: 'core/test', value }))
          island.db.batch(batch, (err, res) => {
            t.error(err, 'batch ok')
            t.equal(res.length, 2)
            cb()
          })
        },
        // TODO: Remove timeout!
        cb => setTimeout(cb, 100),
        cb => {
          island.createSubscription('test', { schema: 'core/test' })
          setTimeout(cb, 100)
        },
        cb => {
          island.readSubscription('test', (err, messages) => {
            t.error(err)
            t.equal(messages.length, 2, 'read two subscriptions')
            cb()
          })
        },
        cb => {
          island.readSubscription('test', (err, messages) => {
            t.error(err)
            t.equal(messages.length, 0, 'second read is empty')
            cb()
          })
        },
        cb => cleanup(cb)
      ]).catch(err => t.fail(err)).then(() => t.end())
    })
  })
})


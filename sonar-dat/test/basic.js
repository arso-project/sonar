const tape = require('tape')
const tmp = require('temporary-directory')
const { stepper } = require('./lib/util')

const { IslandManager } = require('..')

tape('basic', t => {
  tmp((err, dir, cleanup) => {
    t.error(err, 'tempdir ok')
    const islands = new IslandManager(dir)

    islands.create('first', (err, island) => {
      t.error(err, 'island created')

      const step = stepper(finish)

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
      island.batch(batch, err => {
        t.error(err, 'batch ok')
      })

      // TODO: Don't rely on timeouts.
      setTimeout(() => {
      // island.on('indexed-all', () => {
        step((cb) => {
          query(island, 'hello', (err, res) => {
            t.equal(res.length, 2)
            cb(err)
          })
        })
        step((cb) => {
          query(island, 'moon', (err, res) => {
            t.equal(res.length, 1)
            cb(err)
          })
        })
      }, 1000)

      function finish (err) {
        t.error(err, 'finish ok')
        island.api.search.catalog.close()
        cleanup((err) => {
          t.ifError(err)
          t.end()
        })
      }
    })
  })
})

function query (island, query, cb) {
  const results = []
  const rs = island.api.search.query({ query })
  rs.on('data', results.push.bind(results))
  rs.on('error', err => cb(err))
  rs.on('end', () => {
    cb(null, results)
  })
}

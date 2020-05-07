const tape = require('tape')
const tmp = require('temporary-directory')

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

tape('2 islandstores shared island', t => {
  const content = { title: 'I want to', body: 'ride my bicycle' }
  const record = { schema: 'string', value: content }
  createStore({ network: true }, (err, islands1, cleanup1) => {
    t.error(err, 'first store created')
    createStore({ network: true }, (err, islands2, cleanup2) => {
      t.error(err, 'second store created')
      islands1.create('island', (err, island) => {
        t.error(err, 'island on first store created')
        const islandKey = island.key.toString('hex')
        islands2.create('island', { key: islandKey, alias: 'myIslandClone' }, (err, islandClone) => {
          t.error(err, 'opened island with same key in 2nd store')
          island.put(record, (err, id) => {
            t.error(err, 'put record into island on first store')
            setTimeout(getOnSecondIsland, 1000)
            function getOnSecondIsland () {
              islandClone.get({ id }, { waitForSync: true }, (err, records) => {
                t.error(err, 'querying on island of 2nd store')
                t.equal(records.length, 1, 'found record on 2nd store')
                cleanup1(err => {
                  t.error(err)
                  cleanup2(err => {
                    t.error(err)
                    t.end()
                  })
                })
              })
            }
          })
        })
      })
    })
  })
})

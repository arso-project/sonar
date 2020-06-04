const tape = require('tape')
const { runAll, replicate } = require('./lib/util')
const Islands = require('..')
const createStore = require('./lib/create')
const { promisify } = require('util')

tape('put query without replication', async t => {
  let id
  console.log('X')
  const [islands, cleanup] = await createStore({ network: false })
  const island = await promisify(islands.create.bind(islands))('foo')
  await runAll([
    cb => island.ready(cb),
    cb => island.put({ schema: 'doc', value: 'foo' }, (err, _id) => {
      t.error(err)
      id = _id
      cb()
    }),
    cb => island.put({ schema: 'doc', value: 'bar', id }, cb),
    cb => island.query('records', { schema: 'doc' }, { waitForSync: true }, (err, records) => {
      t.error(err)
      t.equal(records.length, 1)
      t.equal(records[0].value, 'bar')
      cb()
    })
  ])
  await cleanup()
  t.end()
})

function doc (value, id) {
  return { schema: 'doc', value, id }
}

tape('simple replication', async t => {
  const [islands1, cleanup1] = await createStore({ network: true })
  const [islands2, cleanup2] = await createStore({ network: true })
  const island = await promisify(islands1.create.bind(islands1))('island1')
  let island2, id
  await runAll([
    cb => island.ready(cb),
    cb => island.put(doc('1rev1'), (err, _id) => {
      t.error(err)
      id = _id
      cb()
    }),
    cb => island.sync(cb),
    cb => island.put(doc('1rev2', id), cb),
    cb => {
      islands2.create('island2', {
        key: island.key,
        alias: 'writer2'
      }, (err, island) => {
        if (err) return cb(err)
        island2 = island
        island2.ready(cb)
      })
    },
    cb => checkOne(t, island, { schema: 'doc' }, '1rev2', 'init island1 ok', cb),
    cb => {
      // console.log('STATUS MID')
      // console.log('island1', island.scope)
      // console.log('island2', island2.scope)
      cb()
    },
    cb => replicate(island, island2, cb),
    cb => island2.sync(cb),
    cb => checkOne(t, island2, { schema: 'doc' }, '1rev2', 'init island2 ok', cb),
    cb => {
      const island2localkey = island2._local.key
      island.putSource(island2localkey, { alias: 'w2' }, cb)
    },
    cb => island.sync(cb),
    cb => {
      island2.put(doc('2rev1', id), cb)
    },
    cb => island.once('remote-update', cb),
    cb => island.sync(cb),
    cb => setTimeout(cb, 100),
    cb => checkOne(t, island, { schema: 'doc' }, '2rev1', 'end island1 ok', cb),
    cb => checkOne(t, island2, { schema: 'doc' }, '2rev1', 'end island2 ok', cb),
    cb => {
      // console.log('STATUS END')
      // console.log('island1', island.scope)
      // console.log('island2', island2.scope)
      cb()
    }
  ])
  await cleanup1()
  await cleanup2()
})

function checkOne (t, island, query, value, msg, cb) {
  island.query('records', query, { waitForSync: true }, (err, records) => {
    // console.log({ msg, query, value, records })
    t.error(err, msg + ' (no err)')
    t.equal(records.length, 1, msg + ' (result len)')
    t.equal(records[0].value, value, msg + '(value)')
    cb()
  })
}

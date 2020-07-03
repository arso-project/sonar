const tape = require('tape')
const { runAll, replicate } = require('./lib/util')
const Collections = require('..')
const createStore = require('./lib/create')
const { promisify } = require('util')

tape('put query without replication', async t => {
  let id
  console.log('X')
  const [collections, cleanup] = await createStore({ network: false })
  const collection = await promisify(collections.create.bind(collections))('foo')
  await runAll([
    cb => collection.ready(cb),
    cb => collection.put({ type: 'doc', value: 'foo' }, (err, _id) => {
      t.error(err)
      id = _id
      cb()
    }),
    cb => collection.put({ type: 'doc', value: 'bar', id }, cb),
    cb => collection.query('records', { type: 'doc' }, { waitForSync: true }, (err, records) => {
      t.error(err)
      t.equal(records.length, 1)
      t.equal(records[0].value, 'bar')
      cb()
    })
  ])
  await cleanup()
  t.end()
})

function doc (title, id) {
  return { type: 'doc', value: { title }, id }
}

tape('simple replication', async t => {
  const [collections1, cleanup1] = await createStore({ network: true })
  const [collections2, cleanup2] = await createStore({ network: true })
  const collection = await promisify(collections1.create.bind(collections1))('collection1')
  let collection2, id
  await runAll([
    cb => collection.ready(cb),
    cb => collection.put(doc('1rev1'), (err, _id) => {
      t.error(err)
      id = _id
      cb()
    }),
    cb => collection.sync(cb),
    cb => collection.put(doc('1rev2', id), cb),
    cb => {
      collections2.create('collection2', {
        key: collection.key,
        alias: 'writer2'
      }, (err, collection) => {
        if (err) return cb(err)
        collection2 = collection
        collection2.ready(cb)
      })
    },
    cb => checkOne(t, collection, { type: 'doc' }, '1rev2', 'init collection1 ok', cb),
    cb => {
      // console.log('STATUS MID')
      // console.log('collection1', collection.scope)
      // console.log('collection2', collection2.scope)
      cb()
    },
    cb => replicate(collection, collection2, cb),
    cb => collection2.sync(cb),
    cb => setTimeout(cb, 100),
    cb => {
      // console.log('STATUS')
      // console.log({ collection, collection2 })
      cb()
    },
    cb => checkOne(t, collection2, { type: 'doc' }, '1rev2', 'init collection2 ok', cb),
    cb => {
      const collection2localkey = collection2._local.key
      collection.putSource(collection2localkey, { alias: 'w2' }, cb)
    },
    cb => collection.sync(cb),
    cb => {
      collection2.put(doc('2rev1', id), cb)
    },
    cb => collection.once('remote-update', cb),
    cb => collection.sync(cb),
    cb => setTimeout(cb, 100),
    cb => {
      // console.log('STATUS')
      // console.log({ collection, collection2 })
      cb()
    },
    cb => checkOne(t, collection, { type: 'doc' }, '2rev1', 'end collection1 ok', cb),
    cb => checkOne(t, collection2, { type: 'doc' }, '2rev1', 'end collection2 ok', cb),
    cb => {
      // console.log('collection1', collection.scope)
      // console.log('collection2', collection2.scope)
      cb()
    }
  ])

  await Promise.all([cleanup1(), cleanup2()])
})

function checkOne (t, collection, query, title, msg, cb) {
  collection.query('records', query, { waitForSync: true }, (err, records) => {
    // console.log({ msg, query, value, records })
    t.error(err, msg + ' (no err)')
    t.equal(records.length, 1, msg + ' (result len)')
    t.equal(records[0].value.title, title, msg + '(value)')
    cb()
  })
}

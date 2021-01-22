const tape = require('tape')
const tmp = require('temporary-directory')
const { createOne } = require('./lib/create')
const debug = require('debug')('time')

tape('subscription stream', async t => {
  t.plan(1)
  try {
    debug('start')
    const complete = clock()
    let timer = clock()
    const { workspace, cleanup } = await createOne()
    debug('init', timer())
    const alltimer = clock()
    timer = clock()
    const collection = await workspace.createCollection('default')
    debug('create collection', timer())

    const sub = collection.subscribe('foo', { live: true }).stream()
    debug('create subscription', timer())

    const [promise, cb] = createPromiseCallback()

    let i = 0
    let subtimer = clock()
    sub.on('data', record => {
      i++
      debug('sub', i, subtimer())
      subtimer = clock()
      if (record.value && record.value.title === 'hello') {
        t.pass('record arrived in subscription stream')
        debug('title correct on record', i)
        cb()
      }
    })

    timer = clock()
    await collection.putType({ name: 'foo', fields: { title: { type: 'string' } } })
    await collection.put({ type: 'foo', value: { title: 'hello' } })
    debug('put took', timer())
    timer = clock()
    const fail = setTimeout(() => t.fail('record was not in subscription stream'), 1000)
    await promise
    clearTimeout(fail)
    debug('sub took', timer())
    debug('all inner', alltimer())

    timer = clock()
    await cleanup()
    debug('cleanup took', timer())
    debug('total', complete())
  } catch (err) {
    t.fail(err)
  }
})

function createPromiseCallback () {
  let cb
  const promise = new Promise((resolve, reject) => {
    cb = function (err, ...args) {
      if (err) return reject(err)
      if (!args.args) args = undefined
      else if (args.length === 1) args = args[0]
      resolve(args)
    }
  })
  return [promise, cb]
}

function clock () {
  const [ss, sn] = process.hrtime()
  return () => {
    const [ds, dn] = process.hrtime([ss, sn])
    const ns = (ds * 1e9) + dn
    const ms = round(ns / 1e6)
    const s = round(ms / 1e3)
    if (s >= 1) return s + 's'
    if (ms >= 0.01) return ms + 'ms'
    if (ns) return ns + 'ns'
  }
}

function round (num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

const tape = require('tape')
const tmp = require('temporary-directory')
const { CollectionStore } = require('..')
const debug = require('debug')('time')

tape('subscription stream', async t => {
  t.plan(1)
  try {
    debug('start')
    const complete = clock()
    let timer = clock()
    const [collections, cleanup] = await createStore({ network: false })
    debug('init', timer())
    const alltimer = clock()
    timer = clock()
    const collection = await pify(cb => collections.create('default', cb))
    debug('create collection', timer())

    timer = clock()
    const sub = collection.pullSubscriptionStream('foo', { live: true })
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
    await pify(cb => collection.put({ type: 'foo', value: { title: 'hello' } }, cb))
    debug('put took', timer())
    timer = clock()
    await promise
    debug('sub took', timer())
    debug('all inner', alltimer())

    timer = clock()
    await cleanup()
    debug('cleanup took', timer())
    debug('total', complete())
    t.end()
  } catch (err) {
    t.fail(err)
    t.end()
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

function createStore (opts = {}) {
  return new Promise((resolve, reject) => {
    tmp('sonar-test', ondircreated)
    function ondircreated (err, dir, cleanupTempdir) {
      if (err) return reject(err)
      const collections = new CollectionStore(dir, opts)
      collections.ready(err => {
        if (err) return reject(err)
        resolve([collections, cleanup])
      })
      function cleanup () {
        return new Promise((resolve, reject) => {
          collections.close(() => {
            cleanupTempdir(err => {
              err ? reject(err) : resolve()
            })
          })
        })
      }
    }
  })
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

function pify (fn) {
  return new Promise((resolve, reject) => {
    function cb (err, ...res) {
      if (err) return reject(err)
      if (!res.length) res = undefined
      if (res.length === 1) res = res[0]
      resolve(res)
    }
    fn(cb)
  })
}

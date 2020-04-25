const test = require('tape')
const debug = require('debug')('time')

const createServerClient = require('./util/server')
const clock = require('./util/clock')

test('commands', async t => {
  const [context, client1] = await createServerClient()
  const client2 = context.createClient()

  // A client with a command
  await client1.initCommandClient({
    name: 'pinger',
    commands: {
      ping: {
        oncall (args, channel) {
          t.equal(args, 'hi from client2', 'args ok')
          channel.reply('hi from 2')
          channel.once('data', d => {
            t.equal(d.toString(), 'ping', 'ping ok')
            channel.write('pong')
          })
        }
      }
    }
  })

  const [channel, res] = await client2.callCommand('@pinger ping', 'hi from client2')
  t.equal(res, 'hi from 2', 'response ok')
  channel.write('ping')

  await pify(cb => {
    channel.once('data', d => {
      t.equal(d.toString(), 'pong', 'pong ok')
      cb()
    })
  })

  await context.stop()
  t.end()
})

test('query and subscription commands', async t => {
  // const run = createServerClient(t, { network: false })
  const [context, client] = await createServerClient()
  const complete = clock()
  let timer = clock()
  debug('init', timer())
  const alltimer = clock()
  timer = clock()
  debug('create island', timer())

  timer = clock()
  const sub = await client.createSubscriptionStream('foo')
  debug('create subscription', timer())

  const [promise, cb] = createPromiseCallback()

  let passed
  let i = 0
  let subtimer = clock()
  sub.on('data', record => {
    i++
    debug('sub', i, subtimer())
    subtimer = clock()
    if (record.value && record.value.title === 'hello') {
      debug('title correct on record', i)
      t.pass('record arrived in subscription stream')
      passed = true
      cb()
    }
  })

  timer = clock()
  await client.put({ schema: 'foo', value: { title: 'hello' } })
  debug('put took', timer())
  timer = clock()
  await promise
  debug('sub took', timer())
  debug('all inner', alltimer())

  timer = clock()
  if (!passed) t.fail('record did not arrive in subscription stream')
  debug('cleanup took', timer())
  debug('total', complete())
  await context.stop()
  t.end()
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

function pify (fn) {
  return new Promise((resolve, reject) => {
    function cb (err, ...res) {
      if (err) return reject(err)
      if (!res.length) res = undefined
      else if (res.length === 1) res = res[0]
      resolve(res)
    }
    fn(cb)
  })
}

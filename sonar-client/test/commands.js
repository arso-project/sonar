const test = require('tape')
const debug = require('debug')('time')
const { clock } = require('nanobench-utils')

const createServerClient = require('./util/server')

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

  await new Promise(resolve => {
    channel.once('data', d => {
      t.equal(d.toString(), 'pong', 'pong ok')
      resolve()
    })
  })

  await context.stop()
  t.end()
})

test('subscription commands', async t => {
  const timer = clock()
  const [context, client] = await createServerClient()
  debug(timer.log('init', true))

  const sub = await client.createSubscriptionStream('foo')
  debug(timer.log('create subscription', true))

  const count = 10

  process.nextTick(async () => {
    try {
      for (let i = 0; i < count; i++) {
        await client.put({ schema: 'foo', value: { title: 'hello' } })
        debug(timer.log('put' + i, true))
      }
    } catch (err) {
      t.fail(err)
    }
  })

  await new Promise(resolve => {
    let i = 0
    let received = 0
    sub.on('data', record => {
      i++
      debug(timer.log('read subscription ' + i, true))
      if (record.value && record.value.title === 'hello') {
        received++
      }
      if (received === count) {
        debug('title correct on record', i)
        t.pass('record arrived in subscription stream')
        resolve()
      }
    })
  })

  debug(timer.log('complete', true))
  await context.stop()
  debug(timer.log('shutdown', true))
  t.end()
})

test('query commands', async t => {
  const timer = clock()
  const [context, client] = await createServerClient()
  debug(timer.log('init', true))

  const count = 5
  const schema = 'foo'

  for (let i = 0; i < count; i++) {
    await client.put({ schema, value: { title: 'hello' } })
    debug(timer.log('put' + i, true))
  }

  await client.sync()
  const qs = await client.createQueryStream('records', { schema })
  timer.debug('create qs')

  await new Promise(resolve => {
    let i = 0
    qs.on('data', record => {
      i++
      t.equal(record.value.title, 'hello')
    })
    qs.on('end', () => {
      t.equal(i, count)
      resolve()
    })
  })

  timer.debug('complete')
  await context.stop()
  timer.debug('shutdown')
  t.end()
})

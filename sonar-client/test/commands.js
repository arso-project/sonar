require('axios-debug-log')
const tape = require('tape')
const { SonarClient } = require('..')

const { makeClient } = require('./util/server')

tape.only('commands', async t => {
  let [client1, cleanup] = await makeClient()
  const client2 = new SonarClient(client1.endpoint)

  client1.createCommandStream({
    name: 'pinger',
    commands: {
      ping: {
        oncall (args, channel) {
          t.equal(args, 'client2', 'args match')
          channel.once('data', d => {
            t.equal(d.toString(), 'hi from 2', 'data matches')
            channel.reply('pong from 1')
          })
        }
      }
    }
  })
  const commands2 = client2.createCommandStream()
  setTimeout(() => {
    const ch = commands2.call('@pinger ping', 'client2', (err, res, channel) => {
      console.log('remote cmds on 2', commands2.remoteManifest)
      t.equal(res, 'pong from 1')
      close()
    })
    ch.io.write(Buffer.from('hi from 2'))
  }, 100)
  async function close () {
    client2.close()
    console.log('now close')
    await cleanup()
    console.log('clean')
    t.end()
  }
})

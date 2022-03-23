const makeClient = require('../client')
const collect = require('stream-collector')

exports.describe = 'execute command'
exports.command = 'command'
exports.handler = async function (argv) {
  const client = makeClient(argv)
  const stream = client.createCommandStream()
  const channel = stream.call('ping')
  channel.on('error', err => console.error('error', err))
  channel.on('reply', reply => {
    console.log('reply', reply)
    channel.io.end()
  })
}

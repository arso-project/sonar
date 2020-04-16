const Server = require('./server')
const options = require('./bin/lib/options')
const args = require('yargs').options(options).argv

const server = new Server(args)
server.start(() => {
  console.log(`listening on http://${server.hostname}:${server.port}`)
})

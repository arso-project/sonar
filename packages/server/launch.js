// require('make-promises-safe')
const Server = require('./server')
const options = require('./bin/lib/options')
const args = require('yargs').options(options).argv

const server = new Server(args)
server.start(err => {
  if (err) {
    console.error(err)
    server.api.log.error(err)
    process.exit(1)
  }
  const address = `http://${server.hostname}:${server.port}`
  server.api.log.info(`API is listening on ${address}`)
  const code = server.api.auth.getRootAccessCode()
  server.api.log.info(`Root access code: ${code}`)
  // TODO: Support both accessCodes and tokens in initial URL to pass to browser clients.
  server.api.log.info(`UI login link: ${address}#/login/${code}`)
  if (server.api.config.dev) {
    server.api.log.info(`Dev UI is ready on ${address}/ui-dev/#/login/${code}`)
  }
})

const SonarServer = require('../server.js')
const { printLogo } = require('@arso-project/sonar-cli/util/logo.js')

exports.command = 'server <command>'
exports.describe = 'server'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'start',
      describe: 'start the sonar server',
      handler: start,
      builder: {
        port: {
          alias: 'p',
          describe: 'port',
          default: 9191
        },
        hostname: {
          alias: 'h',
          describe: 'hostname',
          default: 'localhost'
        },
        storage: {
          alias: 's',
          describe: 'The storage path for this sonar server',
        }
      }
    })
    .command({
      command: 'stop',
      describe: 'stop server',
      handler: stop
    })
}

function start (argv) {
  const opts = {
    port: argv.port,
    hostname: argv.hostname,
    storage: argv.storage
  }

  printLogo()

  const server = SonarServer(opts)
  server.start(() => {
    console.log(`listening on http://${server._host}:${server._port}`)
  })
}

exports.startServer = start

function stop (args) {
  console.error('not implemented')
}

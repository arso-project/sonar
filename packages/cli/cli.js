#!/usr/bin/env node

const yargs = require('yargs')
const debug = require('debug')('sonar-cli')
const { printLogo } = require('./util/logo')

const DEFAULT_ENDPOINT = 'http://localhost:9191/api'
const DEFAULT_COLLECTION = 'default'

const args = yargs
  .usage('sonar <command>')
  // .commandDir('bin')
  .command(require('./bin/command.js'))
  .command(require('./bin/db.js'))
  .command(require('./bin/fs.js'))
  .command(require('./bin/collection.js'))
  .command(require('./bin/device.js'))
  .command(require('./bin/search.js'))
  .command(require('./bin/status.js'))
  .help()
  // TODO: Yargs doesn't provide a clean way to alias the help command as the default command
  // (if invoked without any args). The following default command is manual default command,
  // and I cannot find a way to display the output of the help command in there. Weird yargs.
  .command({
    command: '$0',
    async handler (argv) {
      const msg = [
        'Usage: sonar <command>',
        'The "help" command provides a list of commands.'
      ].join('\n')
      printLogo()
      console.log(msg)
    }
  })
  .options({
    endpoint: {
      alias: 'e',
      describe: 'api endpoint url',
      default: process.env.SONAR_ENDPOINT || DEFAULT_ENDPOINT
    },
    collection: {
      alias: 'c',
      describe: 'collection key or name',
      default: process.env.SONAR_COLLECTION || DEFAULT_COLLECTION
    },
    token: {
      describe: 'access token'
    }
  })
  .help()
  .fail((msg, err, yargs) => {
    if (!err) printLogo()
    if (msg) console.error(msg)
    if (err && err.response && err.response.data && err.response.data.error) {
      console.error(err.response.data.error)
    } else if (err && err.toString) {
      console.error(err.toString())
    } else if (err) {
      console.error(err)
    }
    debug(err)
  })
  .demandCommand()

if (require.main === module) {
  args.argv
} else {
  module.exports = args
}

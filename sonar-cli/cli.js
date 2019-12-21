#!/usr/bin/env node

const yargs = require('yargs')
const debug = require('debug')('sonar-cli')
const { printLogo } = require('./util/logo')

const args = yargs
  .usage('sonar <command>')
  // .commandDir('bin')
  .command(require('./bin/command.js'))
  .command(require('./bin/db.js'))
  .command(require('./bin/fs.js'))
  .command(require('./bin/island.js'))
  .command(require('./bin/search.js'))
  .command(require('./bin/status.js'))
  .options({
    endpoint: {
      alias: 'e',
      describe: 'api endpoint url',
      default: 'http://localhost:9191/api'
    },
    island: {
      alias: 'i',
      describe: 'island key or name',
      default: 'default'
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

if (require.main === module) {
  args.demandCommand()
    .help()
    .argv
} else {
  module.exports = args
}

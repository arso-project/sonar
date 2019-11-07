#!/usr/bin/env node
const yargs = require('yargs')

const args = yargs
  .usage('sonar <command>')
  .commandDir('bin')
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

if (require.main === module) {
  args.demandCommand()
    .help()
    .argv
} else {
  module.exports = args
}

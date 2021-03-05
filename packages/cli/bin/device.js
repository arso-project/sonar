const chalk = require('chalk')
const makeClient = require('../client')
const yargs = require('yargs')

exports.command = 'device'
exports.describe = 'manage this Sonar instance'
exports.handler = function () {
  yargs.showHelp()
}
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'create-access-code',
      describe: 'create new access code',
      handler: createAccesssCode
    })
}

async function createAccesssCode (argv) {
  const client = makeClient(argv)
  const res = await client.fetch('/create-access-code', { method: 'POST' })
  console.log(res)
}

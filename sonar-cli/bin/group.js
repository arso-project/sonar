const chalk = require('chalk')
const makeClient = require('../client')
const yargs = require('yargs')

exports.command = 'group'
exports.describe = 'manage groups'
exports.handler = function () {
  yargs.showHelp()
}
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'create <name> [key]',
      describe: 'create a new group',
      builder: {
        alias: {
          alias: 'a',
          describe: 'your alias (stored in your feed)'
        }
      },
      handler: create
    })
    .command({
      command: 'list',
      describe: 'list groups',
      handler: list
    })
    .command({
      command: 'add-source <name> <key>',
      describe: 'add a source to the group',
      handler: addSource
    })
    .command({
      command: 'debug',
      describe: 'get debug information',
      handler: debug
    })
    .help()
}

async function create (argv) {
  const client = makeClient(argv)
  const name = argv.name
  const key = argv.key
  const alias = argv.alias
  const result = await client.createGroup(name, { key, alias })
  console.log(result)
}

async function addSource (argv) {
  const client = makeClient(argv)
  const { key, name } = argv
  const info = { name }
  const result = await client.putSource(key, info)
  console.log(result)
}

async function list (argv) {
  const client = makeClient(argv)
  const info = await client.info()
  const output = Object.values(info.groups).map(group => {
    return [
      chalk.bold.blueBright(group.name),
      group.key.toString('hex'),
      'Shared: ' + chalk.bold(group.share ? 'Yes' : 'No'),
      'Local key: ' + chalk.bold(group.localKey),
      'Local drive: ' + chalk.bold(group.localDrive)
    ].join('\n')
  }).join('\n\n')
  console.log(output)
}

async function debug (argv) {
  const client = makeClient(argv)
  const result = await client._request({ path: [argv.group, 'debug'] })
  console.log(result)
}

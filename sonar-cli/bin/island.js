const chalk = require('chalk')
const makeClient = require('../client')

exports.command = 'island <command>'
exports.describe = 'manage islands'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'create <name> [key]',
      describe: 'create a new island',
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
      describe: 'list islands',
      handler: list
    })
    .command({
      command: 'add-source <name> <key>',
      describe: 'add a source to the island',
      handler: addSource
    })
}

async function create (argv) {
  const client = makeClient(argv)
  const name = argv.name
  const key = argv.key
  const alias = argv.alias
  const result = await client.createIsland(name, { key, alias })
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
  const output = Object.values(info.islands).map(island => {
    return [
      chalk.bold.blueBright(island.name),
      island.key.toString('hex'),
      'Shared: ' + chalk.bold(island.share ? 'Yes' : 'No')
    ].join('\n')
  }).join('\n\n')
  console.log(output)
}

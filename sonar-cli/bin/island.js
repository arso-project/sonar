const chalk = require('chalk')
const makeClient = require('../client')

exports.command = 'island <command>'
exports.describe = 'manage islands'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'create <name>',
      describe: 'create a new island',
      handler: create
    })
    .command({
      command: 'list',
      describe: 'list islands',
      handler: list
    })
}

async function create (argv) {
  const client = makeClient(argv)
  const name = argv.name
  const result = await client.createIsland(name)
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

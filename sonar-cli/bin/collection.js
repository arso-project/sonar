const chalk = require('chalk')
const makeClient = require('../client')
const yargs = require('yargs')

exports.command = 'collection'
exports.describe = 'manage collections'
exports.handler = function () {
  yargs.showHelp()
}
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'create <name> [key]',
      describe: 'create a new collection',
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
      describe: 'list collections',
      handler: list
    })
    .command({
      command: 'addFeed <name> <key>',
      describe: 'add a feed to the collection',
      handler: addFeed
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
  const collection = await client.createCollection(name, { key, alias })
  console.log(collection.info)
}

async function addFeed (argv) {
  const client = makeClient(argv)
  const collection = await client.focusedCollection()
  const { key, name } = argv
  const info = { name }
  const result = await collection.addFeed(key, info)
  console.log(result)
}

async function list (argv) {
  const client = makeClient(argv)
  const info = await client.info()
  const output = Object.values(info.collections).map(collection => {
    return [
      chalk.bold.blueBright(collection.name),
      collection.key.toString('hex'),
      'Shared: ' + chalk.bold(collection.share ? 'Yes' : 'No'),
      'Local key: ' + chalk.bold(collection.localKey),
      'Local drive: ' + chalk.bold(collection.localDrive)
    ].join('\n')
  }).join('\n\n')
  console.log(output)
}

async function debug (argv) {
  const client = makeClient(argv)
  const result = await client._request({ path: [argv.collection, 'debug'] })
  console.log(result)
}

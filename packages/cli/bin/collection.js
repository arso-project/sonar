const chalk = require('chalk')
const makeClient = require('../client')
const yargs = require('yargs')
const prettyBytes = require('pretty-bytes')

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
      command: 'info',
      describe: 'info about collection',
      handler: info
    })
    .command({
      command: 'addFeed <name> <key>',
      describe: 'add a feed to the collection',
      handler: addFeed,
      builder: {
        type: {
          alias: 't',
          describe: 'feed type'
        }
      }
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
  const collection = await client.openCollection(argv.collection)
  const { key, name, type } = argv
  const info = { name, type }
  const result = await collection.addFeed(key, info)
  console.log(result)
}

async function info (argv) {
  const client = makeClient(argv)
  const collection = await client.openCollection(argv.collection)
  // const status = await collection.status()
  console.log(JSON.stringify(collection.info))
}

async function list (argv) {
  const client = makeClient(argv)
  const collections = await client.listCollections()
  const output = Object.values(collections)
    .map(collection => {
      return [
        chalk.bold.blueBright(collection.name),
        collection.key.toString('hex'),
        'Shared:      ' + chalk.bold(collection.config.share ? 'Yes' : 'No'),
        'Local key:   ' + chalk.bold(collection.localKey),
        'Length:      ' + chalk.bold(collection.length),
        'Feeds:',
        '    ' + collection.feeds.map(feed => {
          return '        ' + [
            'Key: ' + feed.key,
            'Type: ' + feed.type,
            'Length: ' + feed.length,
            'Size: ' + prettyBytes(feed.byteLength)
          ].join('    ')
        }).join('\n    ')
      ].join('\n')
    })
    .join('\n\n')
  console.log(output)
}

async function debug (argv) {
  const client = makeClient(argv)
  const result = await client._request({ path: [argv.collection, 'debug'] })
  console.log(result)
}

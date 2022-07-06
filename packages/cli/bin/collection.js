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
  if (argv.json) console.log(JSON.stringify(collection.info))
  else console.log(showCollection(collection.info))
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
  if (argv.json) console.log(JSON.stringify(collection.info))
  else console.log(showCollection(collection.info))
}

async function list (argv) {
  const client = makeClient(argv)
  const collections = await client.listCollections()
  const output = Object.values(collections)
    .map(collection => showCollection(collection))
    .join('\n\n')
  console.log(output)
}

function showCollection (info) {
  return [
    'Name:        ' + chalk.bold.blueBright(info.name),
    'Primary key: ' + chalk.bold(info.key.toString('hex')),
    'Shared:      ' + chalk.blue(info.config.share ? 'Yes' : 'No'),
    'Local key:   ' + chalk.blue(info.localKey),
    'Length:      ' + chalk.blue(info.length),
    'Feeds:',
    info.feeds.map(feed => {
      return [
        '        ' + 'Key: ' + feed.key,
        '        ' + [
          'Type: ' + chalk.blue(feed.type),
          ' Length: ' + chalk.blue(feed.length),
          ' Size: ' + chalk.blue(prettyBytes(feed.byteLength)),
          ' Writable: ' + chalk.blue(feed.writable ? 'yes' : 'no')
        ].join('')
      ].join('\n')
    }).join('\n')
  ].join('\n')
}

async function debug (argv) {
  const client = makeClient(argv)
  const result = await client._request({ path: [argv.collection, 'debug'] })
  console.log(result)
}

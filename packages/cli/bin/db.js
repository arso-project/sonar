const makeClient = require('../client')
// const chalk = require('chalk')
// const pretty = require('pretty-bytes')
const table = require('text-table')
// const date = require('date-fns')
const collect = require('stream-collector')
const yargs = require('yargs')

exports.command = 'db'
exports.describe = 'database put, get, query'
exports.handler = () => yargs.showHelp()
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'get <id>',
      describe: 'get records',
      builder: {
        type: {
          alias: 't',
          describe: 'type'
        },
        type: {
          alias: 'j',
          boolean: true,
          describe: 'output as json'
        }
      },
      handler: get
    })
    .command({
      command: 'put [id]',
      describe: 'put record from stdin',
      builder: {
        type: {
          alias: 't',
          describe: 'type',
          required: true
        },
        data: {
          alias: 'd',
          describe: 'data (if not passed STDIN is used)'
        }
      },
      handler: put
    })
    .command({
      command: 'query [name] [args]',
      describe: 'query',
      handler: query
    })
    .command({
      command: 'put-type',
      describe: 'put type (JSON from stdin)',
      handler: putType
    })
    .command({
      command: 'get-type [name]',
      describe: 'get type',
      handler: getType
    })
    .command({
      command: 'list-types',
      describe: 'list types',
      handler: listTypes
    })
    .command({
      command: 'reindex [views]',
      describe: 'force reindex of all views. optionally set a comma-seperated list of views to reindex',
      handler: reindex
    })
    .help()
}

async function get (argv) {
  const client = makeClient(argv)
  const { id, type } = argv
  const records = await client.get({ id, type })
  if (argv.json) return console.log(JSON.stringify(records))
  const rows = []
  for (const record of records) {
    const type = record.getType()
    rows.push(['id', record.id])
    rows.push(['type', type.address])
    for (const fieldValue of record.fields()) {
      rows.push(['  ', fieldValue.field.name, JSON.stringify(fieldValue.value)])
    }
    rows.push(['--', '--'])
  }
  console.log(table(rows))
}

async function put (argv) {
  const client = makeClient(argv)
  let { type, id, data } = argv
  if (!data) {
    data = await collectJson(process.stdin)
  } else {
    data = JSON.parse(data)
  }
  const record = { type, id, value: data }
  const result = await client.put(record)
  console.log(result.id)
}

async function query (argv) {
  const client = makeClient(argv)
  let { name, args } = argv
  if (args) args = JSON.parse(args)
  const results = await client.query(name, args)
  console.log(results)
}

async function putType (argv) {
  const client = makeClient(argv)
  const collection = await client.focusedCollection()
  const value = await collectJson(process.stdin)
  const result = await collection.putType(value)
  console.log(result)
}

async function getType (argv) {
  const client = makeClient(argv)
  const { name } = argv
  const result = await client.getType(name)
  console.log(JSON.stringify(result))
}

async function listTypes (argv) {
  const client = makeClient(argv)
  const types = await client.getTypes()
  if (!types) return console.error('No types')
  console.log(Object.keys(types).join('\n'))
}

async function reindex (argv) {
  const client = makeClient(argv)
  const collection = await client.openCollection(argv.collection)
  let views
  if (argv.views) views = argv.views.split(',').map(s => s.trim()).filter(f => f)
  await collection.reindex(views)
  if (!views || !views.length) console.log('Reindex for all views started.')
  else console.log('Reindex started for views: ' + views.join(', '))
}

function collectJson () {
  return new Promise((resolve, reject) => {
    collect(process.stdin, async (err, buf) => {
      if (err) return console.error(err)
      try {
        const value = JSON.parse(buf.toString())
        resolve(value)
      } catch (e) {
        console.error(e.message)
        reject(e)
      }
    })
  })
}

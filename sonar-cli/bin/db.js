const makeClient = require('../client')
// const chalk = require('chalk')
// const pretty = require('pretty-bytes')
// const table = require('text-table')
// const date = require('date-fns')
const collect = require('stream-collector')

exports.command = 'db <command>'
exports.describe = 'database'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'get <id>',
      describe: 'get records',
      builder: {
        schema: {
          alias: 's',
          describe: 'schema'
        }
      },
      handler: get
    })
    .command({
      command: 'put [id]',
      describe: 'put record from stdin',
      builder: {
        schema: {
          alias: 's',
          describe: 'schema',
          required: true
        }
      },
      handler: put
    })
    .command({
      command: 'put-schema [name]',
      describe: 'put schema from stdin',
      handler: putSchema
    })
}

async function get (argv) {
  const client = makeClient(argv)
  const { id, schema } = argv
  const records = await client.get({ id, schema })
  console.log(JSON.stringify(records))
}

async function put (argv) {
  const client = makeClient(argv)
  const { schema, id } = argv
  collect(process.stdin, async (err, buf) => {
    if (err) return console.error(err)
    try {
      const value = JSON.parse(buf.toString())
      const record = { schema, id, value }
      const result = await client.put(record)
      console.log(result.id)
    } catch (e) {
      console.error(e.message)
    }
  })
}

async function putSchema (argv) {
  const client = makeClient(argv)
  const { name } = argv
  collect(process.stdin, async (err, buf) => {
    if (err) return console.error(err)
    try {
      const value = JSON.parse(buf.toString())
      const result = await client.putSchema(name, value)
      console.log(result)
    } catch (e) {
      console.error(e.message)
    }
  })
}

const minimist = require('minimist')
require('axios-debug-log')

const Client = require('@arso-project/sonar-client')

function usage () {
  console.log(`sonar [options] COMMAND
Options:
 --endpoint, -e: Endpoint URL

Commands:
  put-fixtures:  Put development fixtures
  search:        Search
`)
  process.exit(1)
}

const argv = minimist(process.argv.slice(2), {
  default: {
    endpoint: 'http://localhost:9191/api',
    island: 'default'
  },
  alias: {
    e: 'endpoint',
    i: 'island'
  }
})

const [command, ...args] = argv._

const client = new Client(argv.endpoint, argv.island)

if (command === 'put-fixtures') {
  putFixtures(args)
} else if (command === 'search') {
  search(args)
} else {
  usage()
}

async function putFixtures () {
  const schema = {
    properties: {
      title: { type: 'string', title: 'Title' },
      body: { type: 'string', title: 'Body' },
      date: { type: 'string', format: 'date-time', title: 'Published' }
    }
  }
  const record = {
    schema: 'doc',
    value: {
      title: 'Hello world',
      body: 'This is another Sonar demo',
      date: new Date()
    }
  }
  const res = await client.putSchema('doc', schema)
  console.log('putSchema', res)
  const id = await client.put(record)
  console.log('put', id)
}

async function search (query) {
  const results = await client.search(query)
  console.log(results)
}


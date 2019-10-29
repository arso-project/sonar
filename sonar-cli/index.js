const minimist = require('minimist')
require('axios-debug-log')

const Client = require('@arso-project/sonar-client')

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

console.log(argv)
const [command, ...args] = argv._
if (!command) usage()

const client = new Client(argv.endpoint, argv.island)

if (command === 'put-fixtures') {
  putFixtures(args)
} else if (command === 'search') {
  search(args)
} else {
  usage()
}

async function putFixtures () {
  await client.putSchema('doc', {
    properties: {
      title: { type: 'string' },
      body: { type: 'string' }
    }
  })
  const id = await client.put({
    schema: 'doc',
    value: {
      title: 'Hello world',
      body: 'This is a Sonar demo'
    }
  })
  console.log('PUT', id)
}

async function search () {
  const results = await client.search(args[0])
  console.log(results)
}

function usage () {
  console.log(`sonar [options] COMMAND
Options:
 --endpoint, -e: Endpoint URL

Commands:
  put-fixtures:  Put development fixtures
`)
  process.exit(1)
}

const Client = require('@arso-project/sonar-client')

module.exports = function getClient (argv) {
  const client = new Client({
    endpoint: argv.endpoint,
    collection: argv.collection,
    cache: false
  })
  return client
}

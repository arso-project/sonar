const Client = require('@arso-project/sonar-client/node')

module.exports = function getClient (argv) {
  const client = new Client({
    endpoint: argv.endpoint,
    collection: argv.collection,
    token: argv.token,
    cache: false
  })
  return client
}

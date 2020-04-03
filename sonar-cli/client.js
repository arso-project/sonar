const Client = require('@arso-project/sonar-client')

module.exports = function getClient (argv) {
  const client = new Client({
    endpoint: argv.endpoint,
    island: argv.island,
    cache: false
  })
  return client
}

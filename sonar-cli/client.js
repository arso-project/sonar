const Client = require('@arso-project/sonar-client')

module.exports = function getClient (argv) {
  const client = new Client(argv.endpoint, argv.group)
  return client
}

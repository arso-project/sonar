const { Workspace } = require('@arsonar/client/node')

module.exports = function getClient (argv) {
  const workspace = new Workspace({
    endpoint: argv.endpoint,
    collection: argv.collection,
    token: argv.token,
    cache: false
  })
  return workspace
}

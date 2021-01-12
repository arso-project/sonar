const LegacyClient = require('./lib/legacy-client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')
const Client = require('./lib/client')

let globalClient = null

function setup (opts) {
  globalClient = new Client(opts)
  return globalClient
}

function client () {
  return globalClient
}

function createClient (...args) {
  return new LegacyClient(...args)
}

module.exports = Object.assign(createClient, {
  Client,
  SonarClient: LegacyClient,
  SearchQueryBuilder,
  client,
  setup
})

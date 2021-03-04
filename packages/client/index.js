const LegacyClient = require('./lib/legacy-client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')
const Workspace = require('./lib/workspace')

let globalClient = null

function setup (opts) {
  globalClient = createClient(opts)
  return globalClient
}

function client () {
  return globalClient
}

function createClient (...args) {
  return new LegacyClient(...args)
}

module.exports = Object.assign(createClient, {
  Workspace,
  SonarClient: LegacyClient,
  SearchQueryBuilder,
  client,
  setup
})

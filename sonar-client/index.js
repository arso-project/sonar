const LegacyClient = require('./lib/legacy-client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')
const Client = require('./lib/client')

// TODO:
// Currently this exports the LegacyClient by default. Code can switch to the new client
// by importing { Client } by default.
module.exports = function (...args) {
  return new LegacyClient(...args)
}
module.exports.SonarClient = LegacyClient
// TODO: Rethink this, or find better name.
module.exports.SearchQueryBuilder = SearchQueryBuilder

module.exports.Client = Client

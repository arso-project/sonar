const LegacyClient = require('./lib/legacy-client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')
const Workspace = require('./lib/workspace')

module.exports = LegacyClient
module.exports.Workspace = Workspace
module.exports.SearchQueryBuilder = SearchQueryBuilder

const SonarClient = require('./lib/client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')

module.exports = (...args) => new SonarClient(...args)
module.exports.SonarClient = SonarClient
module.exports.SearchQueryBuilder = SearchQueryBuilder

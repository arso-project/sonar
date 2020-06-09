const SonarClient = require('./lib/client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')

module.exports = function (...args) {
  return new SonarClient(...args)
}
module.exports.SonarClient = SonarClient
module.exports.SearchQueryBuilder = SearchQueryBuilder

module.exports.NewClient = require('./new/client')

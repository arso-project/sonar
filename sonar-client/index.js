const SonarClient = require('./lib/client')
const SearchQueryBuilder = require('./lib/searchquerybuilder')

module.exports = Object.assign(SonarClient, {
  SonarClient,
  SearchQueryBuilder
})

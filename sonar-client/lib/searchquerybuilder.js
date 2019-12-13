module.exports = class SearchQueryBuilder {
  constructor (schema) {
    this.schema = schema
    // FIXME: This should not be necessary
    this.query = {
      query: {
      }
    }
  }

  bool (boolType, queries) {
    if (!this.query['query'].hasOwnProperty('bool')) {
      this.query['query']['bool'] = {}
    }
    this.query['query']['bool'][boolType] = queries
    return this
  }

  phrase (field, terms) {
    if (!this.query['query'].hasOwnProperty('phrase')) {
      this.query['query']['phrase'] = {}
    }
    this.query['query']['phrase'][field] = { terms }
  }

  limit (limit) {
    this.query['limit'] = limit
    return this
  }

  term (field, value) {
    return { term: { [field]: value } }
  }

  getQuery () {
    return this.query
  }
  // get query () {
  // return this.query
  // }

  // set query (value) {
  // this.query = value
  // }
}

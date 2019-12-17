module.exports = class SearchQueryBuilder {
  constructor (schema) {
    this.schema = schema
    this.query = {}
  }

  bool (boolType, queries) {
    if (!this.query.hasOwnProperty('bool')) {
      this.query.bool = {}
    }
    this.query.bool[boolType] = queries
    return this
  }

  phrase (field, terms) {
    if (!this.query.hasOwnProperty('phrase')) {
      this.query.phrase = {}
    }
    this.query.phrase[field] = { terms }
    return this
  }

  limit (limit) {
    this.limit = limit
    return this
  }

  term (field, term) {
    if (!this.query.hasOwnProperty('term')) {
      this.query.term = {}
    }
    this.query.term[field] = term
    return this
    //return { term: { [field]: value } }
  }

  getQuery () {
    return { query: this.query, limit: this.limit }
  }
}

module.exports = class QueryBuilder {
  constructor (schema) {
    this.schema = schema
    // FIXME: This should not be necessary
    this.query = {
      query: {
        bool : {},
        phrase : {}
      }
    }
  }

  bool (boolType, queries) {
    this.query['query']['bool'][boolType] = queries
    return this
  }

  phrase (field, terms) {
    this.query['query']['phrase'][field] = { terms }
  }

  limit (limit) {
    this.query['limit'] = limit
    return this
  }

  term (field, value) {
    return {term: { [field]: value }}
  }

  getQuery () {
    return this.query
  }
  //get query () {
    //return this.query
  //}

  //set query (value) {
    //this.query = value
  //}

}

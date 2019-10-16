module.exports = class QueryBuilder {
  constructor (schema) {
    this.schema = schema
    // FIXME: This should not be necessary
    this.query = {
      query: {
        bool : {
          must: [],
          must_not: []
        }
      }
    }
  }

  bool (boolType, queries) {
    this.query['query']['bool'][boolType] = queries
    return this
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

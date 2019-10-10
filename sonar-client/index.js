const axios = require('axios')

module.exports = class SonarClient {
  constructor (baseUrl, islandKey) {
    this.baseUrl = baseUrl
    this.islandKey = islandKey
  }

  create (name) {
    return this._call('PUT', '/_create/' + name)
  }

  getSchema (schemaName) {
    if (this.schema && schemaName === undefined) {
      schemaName = this.schema
    }
    return this._call('GET', '/' + this.islandKey + '/' + schemaName + '/_schema')
  }

  putSchema (schemaName, schema) {
    if (this.schema && schemaName && schema === undefined) {
      schema = schemaName
    }
    return this._call('PUT', '/' + this.islandKey + '/' + this.schema + '/_schema')
  }

  get (schema, id) {
    if (this.schema && id === undefined) {
      id = schema
      schema = this.schema
    }
    return this._call('GET', '/' + this.islandKey + '/' + schema + '/' + id)
  }

  search (schemaName, query) {
    return this._call('POST', '/' + this.islandKey + '/' + schemaName + '/_search', query)
  }

  _call (method, url, data) {
    if (data === undefined) data = {}
    const fullUrl = this.baseUrl + url
    return axios({
      method,
      url: fullUrl,
      data,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

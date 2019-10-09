const axios = require('axios')

// TODO: Config

class SonarClient {
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

const client = new SonarClient('http://localhost:9191', '54d722bf355f5182931a59a9375dd0cd84883fae5acdfc4d568ace8d42c82fca')
client.get('doc', 'YiGVbMKE').then(res => console.log(res.data))
// create new island
client.create('newIsland')
  .then(res => console.log('successful'))
  .catch(error => console.error(error))
client.getSchema('doc')
  .then(res => console.log(res.data))

client.search('doc', '"test"')
  .then(res => res.data.forEach((el) => console.log(el)))
  .catch(err => console.error(err))

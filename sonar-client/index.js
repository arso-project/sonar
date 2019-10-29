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
    return this._call('GET', '/' + this.islandKey + '/' + schemaName + '/_schema')
  }

  putSchema (schemaName, schema) {
    return this._call('PUT', '/' + this.islandKey + '/' + schemaName + '/_schema')
  }

  get ({ schema, id }) {
    if (schema) {
      return this._call('GET', '/' + this.islandKey + '/' + schema + '/' + id)
    } else {
      return this._call('GET', '/' + this.islandKey + '/' + id)
    }
  }

  put (record) {
    const { schema, id, value } = record
    if (id) {
      return this._call('PUT', '/' + this.islandKey + '/' + schema + '/' + id, value)
    } else {
      return this._call('POST', '/' + this.islandKey + '/' + schema, value)
    }
  }

  search (query) {
    if (typeof query === 'string') {
      query = JSON.stringify(query)
    }
    return this._call('POST', '/' + this.islandKey + '/_search', query)
  }

  async readdir (path) {
    const self = this
    if (path.charAt(0) === '/') path = path.substring(1)
    let files = await this._call('GET', '/' + this.islandKey + '/files/' + path)
    if (files && files.length) {
      files = files.map(file => {
        file.link = makeLink(file)
        return file
      })
    }
    return files

    function makeLink (file) {
      return `${self.baseUrl}/${self.islandKey}/files/${file.path}`
    }
  }

  async _call (method, url, data) {
    if (data === undefined) data = {}
    const fullUrl = this.baseUrl + url
    const result = await axios({
      method,
      url: fullUrl,
      data,
      headers: { 'Content-Type': 'application/json' }
    })
    return result.data
  }
}

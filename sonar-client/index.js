const axios = require('axios')

module.exports = class SonarClient {
  constructor (baseUrl, island) {
    this.baseUrl = baseUrl
    this.island = island
  }

  async info () {
    return this._request({
      method: 'GET',
      path: ['_info']
    })
  }

  async createIsland (name) {
    return this._request({
      method: 'PUT',
      path: ['_create', name],
      data: {}
    })
  }

  async getSchema (schemaName) {
    schemaName = schemaName.replace('/', '-')
    return this._request({
      path: [this.island, 'schema', schemaName]
    })
  }

  async putSchema (schemaName, schema) {
    return this._request({
      method: 'PUT',
      path: [this.island, 'schema', schemaName],
      data: schema
    })
  }

  async get ({ schema, id }) {
    let path
    if (schema) {
      schema = encodeURIComponent(schema)
      path = [this.island, 'db', schema, id]
    } else {
      path = [this.island, 'db', id]
    }
    return this._request({ path })
  }

  async put (record) {
    const { schema, id, value } = record
    const path = [this.island, 'db', schema]
    let method = 'POST'
    if (id) {
      method = 'PUT'
      path.push(id)
    }
    return this._request({ path, method, data: value })
  }

  async query (query) {
    return this._request({
      method: 'POST',
      path: [this.island, '_query'],
      data: query
    })
  }

  async search (query) {
    if (typeof query === 'string') {
      query = JSON.stringify(query)
    }
    return this._request({
      method: 'POST',
      path: [this.island, '_search'],
      data: query
    })
  }

  async readdir (path) {
    const self = this
    path = path || '/'
    if (path.length > 2 && path.charAt(0) === '/') path = path.substring(1)
    let files = await this._request({ path: [this.island, 'fs', path] })
    if (files && files.length) {
      files = files.map(file => {
        file.link = makeLink(file)
        return file
      })
    }
    return files

    function makeLink (file) {
      return `${self.baseUrl}/${self.island}/fs/${file.path}`
    }
  }

  async writeFile (path, file) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.island, 'fs', path],
      data: file,
      method: 'PUT',
      binary: true
    })
  }

  async readFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.island, 'fs', path],
      binary: true,
      responseType: 'stream'
    })
  }

  async statFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.island, 'fs', path]
    })
  }

  _url (path) {
    if (Array.isArray(path)) path = path.join('/')
    return this.baseUrl + '/' + path
  }

  async _request (opts) {
    const axiosOpts = {
      method: opts.method || 'GET',
      url: opts.url || this._url(opts.path),
      headers: {
        'Content-Type': 'application/json'
      },
      // axios has a very weird bug that it REMOVES the
      // Content-Type header if data is empty...
      data: opts.data || {},
      responseType: opts.responseType
    }

    if (opts.binary) {
      axiosOpts.headers['content-type'] = 'application/octet-stream'
      axiosOpts.responseType = opts.responseType
    }
    const result = await axios.request(axiosOpts)
    return result.data
  }
}

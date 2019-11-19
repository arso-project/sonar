const axios = require('axios')
const randombytes = require('randombytes')
const Socket = require('simple-websocket')
const { CommandProtocol } = require('./lib/command-protocol')

module.exports = class SonarClient {
  constructor (baseUrl, island, opts = {}) {
    this.baseUrl = baseUrl
    this.island = island || 'default'

    this.id = opts.id || randombytes(16).toString('hex')
    this.name = opts.name || null
    this._sockets = []
  }

  close () {
    this._sockets.forEach(s => s.destroy())
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

  _socket (opts) {
    if (Array.isArray(opts)) opts = { path: opts }
    const url = opts.url || this._url(opts.path)
    const socket = new Socket(url)
    this._sockets.push(socket)
    return socket
  }

  createCommandStream (opts = {}) {
    const { oncommand, commands, name = 'sonar-client' } = opts
    const socket = this._socket([this.island, 'commands'])
    const proto = new CommandProtocol(true, { socket, oncommand, commands, name })
    // proto.hello()
    // if (hello) proto.command('hello', hello)
    return proto
  }
}


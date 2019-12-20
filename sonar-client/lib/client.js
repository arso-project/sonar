const axios = require('axios')
const randombytes = require('randombytes')
const Socket = require('simple-websocket')
const { Endpoint } = require('simple-rpc-protocol')
const debug = require('debug')('sonar-client')

const DEFAULT_BASE_URL = 'http://localhost:9191/api'
const DEFAULT_ISLAND = 'default'
// const TOKEN_HEADER = 'x-sonar-access-token'
const SearchQueryBuilder = require('./searchquerybuilder.js')

module.exports = class SonarClient {
  constructor (endpoint, island, opts = {}) {
    debug('create client', { endpoint, island, opts })
    this.endpoint = endpoint || DEFAULT_BASE_URL
    this.island = island || DEFAULT_ISLAND
    // this.token = opts.token || ''

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

  async createIsland (name, key) {
    const path = ['_create', name]
    if (key) path.push(key)
    return this._request({
      method: 'PUT',
      path
    })
  }

  async getSchema (schemaName) {
    schemaName = this.expandSchema(schemaName)
    return this._request({
      path: [this.island, 'schema', schemaName]
    })
  }

  async putSchema (schemaName, schema) {
    schemaName = this.expandSchema(schemaName)
    return this._request({
      method: 'PUT',
      path: [this.island, 'schema', schemaName],
      data: schema
    })
  }

  async get ({ schema, id }) {
    let path
    schema = this.expandSchema(schema)
    if (schema) {
      path = [this.island, 'db', schema, id]
    } else {
      path = [this.island, 'db', id]
    }
    return this._request({ path })
  }

  async put (record) {
    let { schema, id, value } = record
    schema = this.expandSchema(schema)
    const path = [this.island, 'db', schema]
    let method = 'POST'
    if (id) {
      method = 'PUT'
      path.push(id)
    }
    return this._request({ path, method, data: value })
  }

  async getSchemas () {
    return this._request({
      path: [this.island, 'schema']
    })
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
    } else if (query instanceof SearchQueryBuilder) {
      query = query.getQuery()
    }
    console.log('client', query)
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
      return `${self.endpoint}/${self.island}/fs/${file.path}`
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
    return this.endpoint + '/' + path
  }

  async _request (opts) {
    const axiosOpts = {
      method: opts.method || 'GET',
      url: opts.url || this._url(opts.path),
      maxRedirects: 0,
      headers: {
        'Content-Type': 'application/json'
        // [TOKEN_HEADER]: this.token
      },
      // axios has a very weird bug that it REMOVES the
      // Content-Type header if data is empty...
      data: opts.data || {},
      responseType: opts.responseType
    }
    debug('request', axiosOpts)

    if (opts.binary) {
      axiosOpts.headers['content-type'] = 'application/octet-stream'
      axiosOpts.responseType = opts.responseType
    }
    try {
      const result = await axios.request(axiosOpts)
      return result.data
    } catch (err) {
      const wrappedErr = enhanceAxiosError(err)
      throw wrappedErr
    }
  }

  _socket (opts) {
    if (Array.isArray(opts)) opts = { path: opts }
    const url = opts.url || this._url(opts.path)
    const socket = new Socket(url)
    this._sockets.push(socket)
    return socket
  }

  createCommandStream (opts = {}) {
    const { commands, name = 'sonar-client' } = opts
    const stream = this._socket([this.island, 'commands'])
    const proto = new Endpoint({ stream, commands, name })
    proto.announce()
    // proto.hello()
    // if (hello) proto.command('hello', hello)
    return proto
  }

  expandSchema (schema) {
    if (!schema) return
    if (schema.indexOf('/') !== -1) return schema
    return '_/' + schema
  }
}

function enhanceAxiosError (err) {
  const log = {}
  const { request, response } = err
  if (request) log.request = { method: request.method, path: request.path }
  if (response) log.response = { status: response.status, statusText: response.statusText, headers: response.headers, data: response.data }
  debug(log)

  let msg
  if (err && err.response && typeof err.response.data === 'object' && err.response.data.error) {
    msg = err.response.data.error
  }
  err.remoteError = msg
  if (msg) err.message = err.message + ` (reason: ${msg})`
  return err
}

const axios = require('axios')
const randombytes = require('randombytes')
const Socket = require('simple-websocket')
const { Endpoint } = require('simple-rpc-protocol')
const debug = require('debug')('sonar-client')
const SearchQueryBuilder = require('./searchquerybuilder.js')

const { DEFAULT_ENDPOINT, DEFAULT_ISLAND, SCHEMA_RESOURCE, METADATA_ID } = require('./constants')

module.exports = class SonarClient {
  constructor (endpoint, island, opts = {}) {
    if (typeof endpoint === 'object') {
      opts = endpoint
      endpoint = opts.endpoint
      island = opts.island
    }

    debug('create client', { endpoint, island, opts })
    this.endpoint = endpoint || DEFAULT_ENDPOINT
    this.island = island || DEFAULT_ISLAND
    // this.token = opts.token || ''

    this.id = opts.id || randombytes(16).toString('hex')
    this.name = opts.name || null
    this._sockets = []
  }

  close () {
    this._sockets.forEach(s => s.destroy())
  }

  // TODO: Support read-only islands.
  async isWritable () {
    return true
  }

  async info () {
    return this._request({
      method: 'GET',
      path: ['_info']
    })
  }

  async createIsland (name, opts) {
    const path = ['_create', name]
    // opts = { key, alias }
    return this._request({
      method: 'PUT',
      path,
      data: opts
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

  async putSource (key, info) {
    return this._request({
      method: 'PUT',
      path: [this.island, 'source', key],
      data: info
    })
  }

  async _localDriveKey () {
    // TODO: Don't refetch this info each time.
    const info = await this.getDrives()
    const writableDrives = info.filter(f => f.writable)
    if (!writableDrives.length) throw new Error('No writable drive')
    return writableDrives[0].key
  }

  async createResource (value, opts = {}) {
    let { filename, prefix } = value
    if (!filename) throw new Error('Filename is required')
    if (filename.indexOf('/') !== -1) throw new Error('Invalid filename')
    if (opts.scoped) throw new Error('Scoped option is not supported')

    let filepath
    if (prefix) filepath = [prefix, filename].join('/')
    else filepath = filename

    const drivekey = await this._localDriveKey()
    const fullpath = `${drivekey}/${filepath}`
    const contentUrl = 'hyperdrive://' + fullpath

    let id
    // TODO: Check for resources also/instead?
    // This checks only the local drive.
    try {
      var existing = await this.statFile(fullpath)
    } catch (err) {}

    if (existing) {
      id = existing.metadata[METADATA_ID]
      if (!id) {
        if (!opts.force) throw new Error('file exists and has no resource attached. set fore to overwrite.')
      } else {
        // TODO: Preserve fields from an old resource?
        // const oldResource = await this.get({ id: existing.metadata[METADATA_ID] })
        if (!opts.update) throw new Error(`file exists, with resource ${id}. set update to overwrite.`)
      }
    }

    const res = await this.put({
      schema: SCHEMA_RESOURCE,
      id,
      value: {
        ...value,
        contentUrl,
        filename
      }
    })
    // TODO: This should get by keyseq. Or put should just return the
    // putted record.
    const records = await this.get({ id: res.id, schema: SCHEMA_RESOURCE }, { waitForSync: true })
    if (!records.length) throw new Error('error loading created resource')
    return records[0]
  }

  async get ({ schema, id }, opts) {
    let path
    schema = this.expandSchema(schema)
    if (schema) {
      path = [this.island, 'db', schema, id]
    } else {
      path = [this.island, 'db', id]
    }
    return this._request({ path, params: opts })
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

  async query (query, opts) {
    return this._request({
      method: 'POST',
      path: [this.island, '_query'],
      data: query,
      params: opts
    })
  }

  async search (query) {
    if (typeof query === 'string') {
      query = JSON.stringify(query)
    } else if (query instanceof SearchQueryBuilder) {
      query = query.getQuery()
    }
    return this._request({
      method: 'POST',
      path: [this.island, '_search'],
      data: query
    })
  }

  async getDrives () {
    return this._request({
      method: 'GET',
      path: [this.island, 'fs-info']
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

  async writeFile (path, file, opts) {
    if (!path || !path.length) throw new Error('path is required')
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.island, 'fs', path],
      data: file,
      params: opts,
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
      responseType: opts.responseType,
      params: opts.params
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

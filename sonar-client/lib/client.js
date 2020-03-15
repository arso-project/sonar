const axios = require('axios')
const randombytes = require('randombytes')
const Socket = require('simple-websocket')
const { Endpoint } = require('simple-rpc-protocol')
const debug = require('debug')('sonar-client')
const SearchQueryBuilder = require('./searchquerybuilder.js')
const parseUrl = require('parse-dat-url')

const {
  DEFAULT_ENDPOINT, DEFAULT_ISLAND, SCHEMA_RESOURCE, METADATA_ID, HYPERDRIVE_SCHEME
} = require('./constants')

module.exports = class SonarClient {
  constructor (endpoint, group, opts = {}) {
    if (typeof endpoint === 'object') {
      opts = endpoint
      endpoint = opts.endpoint
      group = opts.group
    }

    debug('create client', { endpoint, group, opts })
    this.endpoint = endpoint || DEFAULT_ENDPOINT
    this.group = group || DEFAULT_ISLAND
    // this.token = opts.token || ''

    this.id = opts.id || randombytes(16).toString('hex')
    this.name = opts.name || null
    this._sockets = []
  }

  close () {
    this._sockets.forEach(s => s.destroy())
  }

  // TODO: Support read-only groups.
  async isWritable () {
    return true
  }

  async info () {
    return this._request({
      method: 'GET',
      path: ['_info']
    })
  }

  async createGroup (name, opts) {
    const path = ['_create', name]
    // opts = { key, alias }
    const res = await this._request({
      method: 'PUT',
      path,
      data: opts
    })
    return res
  }

  async getSchemas () {
    return this._request({
      path: [this.group, 'schema']
    })
  }

  async getSchema (schemaName) {
    return this._request({
      path: [this.group, 'schema'],
      params: { name: schemaName }
    })
  }

  // TODO: Remove schemaName arg
  async putSchema (schemaName, schema) {
    schema.name = schemaName
    return this._request({
      method: 'POST',
      path: [this.group, 'schema'],
      data: schema
    })
  }

  async putSource (key, info) {
    return this._request({
      method: 'PUT',
      path: [this.group, 'source', key],
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

  async writeResourceFile (record, file, opts) {
    if (record.schema !== SCHEMA_RESOURCE) throw new Error('record is not a resource')
    const fileUrl = this.parseHyperdriveUrl(record.value.contentUrl)
    if (!fileUrl) throw new Error('resource has invalid contentUrl')
    const path = fileUrl.host + fileUrl.path
    return this.writeFile(path, file, {
      ...opts,
      metadata: {
        ...(opts.metadata || {}),
        'sonar.id': record.id
      }
    })
  }

  async readResourceFile (record) {
    const fileUrl = this.parseHyperdriveUrl(record.value.contentUrl)
    if (!fileUrl) throw new Error('resource has invalid contentUrl')
    const path = fileUrl.host + '/' + fileUrl.path
    return this.readFile(path)
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
    const contentUrl = `${HYPERDRIVE_SCHEME}//${fullpath}`

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

  parseHyperdriveUrl (link) {
    const url = parseUrl(link)
    if (url.protocol !== HYPERDRIVE_SCHEME) return false
    return url
  }

  async get ({ schema, id }) {
    return this.query('records', { schema, id })
  }

  async put (record) {
    // let { schema, id, value } = record
    const path = [this.group, 'db']
    const method = 'PUT'
    return this._request({ path, method, data: record })
  }

  async query (name, args, opts) {
    return this._request({
      method: 'POST',
      path: [this.group, '_query', name],
      data: args,
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
      path: [this.group, '_query', 'search'],
      data: query
    })
  }

  async updateGroup (config, key) {
    key = key || this.group
    return this._request({
      method: 'PATCH',
      path: [key],
      data: config
    })
  }

  async getDrives () {
    return this._request({
      method: 'GET',
      path: [this.group, 'fs-info']
    })
  }

  async readdir (path) {
    const self = this
    path = path || '/'
    if (path.length > 2 && path.charAt(0) === '/') path = path.substring(1)
    let files = await this._request({ path: [this.group, 'fs', path] })
    if (files && files.length) {
      files = files.map(file => {
        file.link = makeLink(file)
        return file
      })
    }
    return files

    function makeLink (file) {
      return `${self.endpoint}/${self.group}/fs/${file.path}`
    }
  }

  async writeFile (path, file, opts) {
    if (!path || !path.length) throw new Error('path is required')
    if (path.startsWith('/')) path = path.substring(1)
    
    let onUploadProgress
    if (opts.onUploadProgress) {
      onUploadProgress = opts.onUploadProgress
      delete opts.onUploadProgress
    }
    
    return this._request({
      path: [this.group, 'fs', path],
      data: file,
      params: opts,
      method: 'PUT',
      binary: true,
      onUploadProgress
    })
  }

  async readFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.group, 'fs', path],
      binary: true,
      responseType: 'stream'
    })
  }

  async statFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.group, 'fs', path]
    })
  }

  _url (path) {
    if (Array.isArray(path)) path = path.join('/')
    return this.endpoint + '/' + path
  }

  fileUrl (url) {
    const path = url.replace("dat://", "")
    return this.endpoint + '/' + this.group +'/fs/'+ path
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
      params: opts.params,
      onUploadProgress: opts.onUploadProgress,
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
    const stream = this._socket([this.group, 'commands'])
    const proto = new Endpoint({ stream, commands, name })
    proto.announce()
    // proto.hello()
    // if (hello) proto.command('hello', hello)
    return proto
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

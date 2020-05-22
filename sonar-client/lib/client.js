const axios = require('axios')
const randombytes = require('randombytes')
const parseUrl = require('parse-dat-url')
const debug = require('debug')('sonar-client')

const SearchQueryBuilder = require('./searchquerybuilder.js')
const RecordCache = require('./record-cache')
const CommandStreamClient = require('./commands')

const {
  DEFAULT_ENDPOINT,
  DEFAULT_ISLAND,
  SCHEMA_RESOURCE,
  METADATA_ID,
  HYPERDRIVE_SCHEME
} = require('./constants')

module.exports = class SonarClient {
  constructor (opts = {}) {
    this.endpoint = opts.endpoint || DEFAULT_ENDPOINT
    this.island = opts.island || DEFAULT_ISLAND

    this.id = opts.id || randombytes(16).toString('hex')
    this.name = opts.name || null

    this._cache = new RecordCache()

    if (opts.cache !== false) {
      this._cacheid = 'client:' + this.id + ':' + this.island
    }

    debug(`create client: endpoint ${this.endpoint} island ${this.island}`)
  }

  close () {
    if (this._commandClient) this._commandClient.close()
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
    const res = await this._request({
      method: 'PUT',
      path,
      data: opts
    })
    return res
  }

  async focusIsland (name) {
    if (!name && this.island) name = this.island
    if (!name) throw new Error('Missing island name')
    if (name === this.island && this._info) return this._info
    if (name === this.island && this._islandInfoPromise) return this._islandInfoPromise

    this._islandInfoPromise = this._getIslandInfo(name)
    return this._islandInfoPromise
  }

  async _getIslandInfo (name) {
    const res = await this._request({ path: [name] })
    this._info = res

    if (this._info.name !== this.island) {
      this.island = res.name
      this._cache.reset()
    }

    return this._info
  }

  async getCurrentIsland () {
    if (!this._info) await this.focusIsland()
    return this._info
  }

  async getSchemas () {
    return this._request({
      path: [this.island, 'schema']
    })
  }

  async getSchema (schemaName) {
    return this._request({
      path: [this.island, 'schema'],
      params: { name: schemaName }
    })
  }

  // TODO: Remove schemaName arg
  async putSchema (schemaName, schema) {
    schema.name = schemaName
    return this._request({
      method: 'POST',
      path: [this.island, 'schema'],
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

  async writeResourceFile (record, file, opts = {}) {
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

  async readResourceFile (record, opts = {}) {
    const fileUrl = this.parseHyperdriveUrl(record.value.contentUrl)
    if (!fileUrl) throw new Error('resource has invalid contentUrl')
    const path = fileUrl.host + '/' + fileUrl.path
    return this.readFile(path, opts)
  }

  async createResource (value, opts = {}) {
    const { filename, prefix } = value
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

    id = id || opts.id

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

  resourceHttpUrl (record) {
    const url = this.parseHyperdriveUrl(record.value.contentUrl)
    if (!url) throw new Error('resource has invalid contentUrl')
    let filepath = url.path
    if (filepath.startsWith('/')) filepath = filepath.substring(1)
    const path = this._url([this.island, 'fs', url.host, filepath])
    return path
  }

  async get ({ schema, id }, opts) {
    return this.query('records', { schema, id }, opts)
  }

  async put (record) {
    // let { schema, id, value } = record
    const path = [this.island, 'db']
    const method = 'PUT'
    return this._request({ path, method, data: record })
  }

  async del (record) {
    const path = [this.island, 'db', record.id]
    const method = 'DELETE'
    const params = { schema: record.schema }
    return this._request({ path, method, params })
  }

  async sync (view) {
    const path = [this.island, 'sync']
    const params = {}
    if (view) params.view = view
    return this._request({ path, params })
  }

  async query (name, args, opts = {}) {
    if (this._cacheid) {
      opts.cacheid = this._cacheid
    }

    const records = await this._request({
      method: 'POST',
      path: [this.island, '_query', name],
      data: args,
      params: opts
    })

    if (this._cacheid) {
      return this._cache.batch(records)
    }

    return records
  }

  async search (query) {
    if (typeof query === 'string') {
      query = JSON.stringify(query)
    } else if (query instanceof SearchQueryBuilder) {
      query = query.getQuery()
    }
    return this.query('search', query)
  }

  async updateIsland (key, config) {
    key = key || this.island
    return this._request({
      method: 'PATCH',
      path: [key],
      data: config
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
    if (path === '/') {
      const drives = await this.getDrives()
      return drives.map(drive => ({
        name: drive.alias,
        link: '',
        resource: null,
        length: null,
        directory: true
      }))
    }
    if (path.length > 2 && path.charAt(0) === '/') path = path.substring(1)
    const alias = path.split('/')[0]
    let files = await this._request({ path: [this.island, 'fs', path] })
    if (files && files.length) {
      files = files.map(file => {
        file.link = makeLink(file)
        file.resource = getResource(file)
        return file
      })
    }
    return files

    function makeLink (file) {
      return `${self.endpoint}/${self.island}/fs/${alias}/${file.path}`
    }

    function getResource (file) {
      if (!file || !file.metadata || !file.metadata['sonar.id']) return null
      return file.metadata['sonar.id']
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
      path: [this.island, 'fs', path],
      data: file,
      params: opts,
      method: 'PUT',
      binary: true,
      onUploadProgress
    })
  }

  async readFile (path, opts = {}) {
    const { stream = true } = opts
    if (path.startsWith('/')) path = path.substring(1)
    const request = {
      path: [this.island, 'fs', path],
      binary: true
    }
    if (stream) request.responseType = 'stream'
    return this._request(request)
  }

  async statFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this._request({
      path: [this.island, 'fs', path]
    })
  }

  async pullSubscription (name, opts) {
    return this._request({
      path: [this.island, 'subscription', name],
      query: opts
    })
  }

  async ackSubscription (name, cursor) {
    return this._request({
      method: 'post',
      path: [this.island, 'subscription', name, cursor]
    })
  }

  _url (path) {
    if (Array.isArray(path)) path = path.join('/')
    return this.endpoint + '/' + path
  }

  fileUrl (url) {
    const path = url.replace('dat://', '')
    return this.endpoint + '/' + this.island + '/fs/' + path
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
      onUploadProgress: opts.onUploadProgress
    }
    debug('request: %s %s', axiosOpts.method, axiosOpts.url)

    if (opts.binary) {
      axiosOpts.headers['content-type'] = 'application/octet-stream'
      axiosOpts.responseType = opts.responseType
    }
    try {
      const result = await axios.request(axiosOpts)
      debug('response: %s %s (length %s)', result.status, result.statusText, result.headers['content-length'])
      return result.data
    } catch (err) {
      const wrappedError = wrapAxiosError(err)
      debug('response: %o', wrappedError.message)
      throw wrappedError
    }
  }

  async initCommandClient (opts = {}) {
    if (this._commandClient) throw new Error('Command client already initialized')
    opts = {
      url: this._url(['_commands']),
      ...opts,
      env: {
        ...opts.env || {},
        island: this.island
      },
      name: opts.name || 'client:' + this.id,
      commands: opts.commands || {}
    }
    this._commandClient = new CommandStreamClient(opts)
    await this._commandClient.open()
  }

  async callCommand (command, args) {
    if (!this._commandClient) await this.initCommandClient()
    return this._commandClient.call(command, args)
  }

  async callCommandStreaming (command, args) {
    if (!this._commandClient) await this.initCommandClient()
    return this._commandClient.callStreaming(command, args)
  }

  async createQueryStream (name, args, opts = {}) {
    // if (opts.cacheid === undefined && this._cacheid) {
    //   opts.cacheid = this._cacheid
    // }
    const [channel] = await this.callCommand('@island query', [name, args, opts])
    // const transform = this._cache.transform()
    // return channel.pipe(transform)
    return channel
  }

  async createSubscriptionStream (name, opts = {}) {
    // if (opts.cacheid === undefined && this._cacheid) {
    //   opts.cacheid = this._cacheid
    // }
    const [channel] = await this.callCommand('@island subscribe', [name, opts])
    // const transform = this._cache.transform()
    // return channel.pipe(transform)
    return channel
  }
}

function wrapAxiosError (err) {
  const log = {}
  const { request, response, config } = err
  if (config) {
    log.config = {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    }
    err.config = log.config
  }
  if (request) {
    log.request = {
      method: request.method,
      path: request.path
    }
    err.request = log.request
  }
  if (response) {
    log.response = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    }
    err.response = log.response
  }
  // debug(log)

  let msg
  if (err && err.response && typeof err.response.data === 'object' && err.response.data.error) {
    msg = err.response.data.error
  } else {
    msg = err.message
  }
  err.remoteError = msg
  if (msg) err.message = err.message + ` (reason: ${msg})`
  return err
}

const debug = require('debug')('sonar-client')
const axios = require('axios')

const Island = require('./island')

const {
  DEFAULT_ENDPOINT,
  DEFAULT_ISLAND,
  SCHEMA_RESOURCE,
  METADATA_ID,
  HYPERDRIVE_SCHEME
} = require('./constants')

module.exports = class Client {
  constructor (opts = {}) {
    this.endpoint = opts.endpoint || DEFAULT_ENDPOINT
    if (!this.endpoint.endsWith('/')) {
      this.endpoint = this.endpoint + '/'
    }
    this.islands = new Map()
  }

  async listIslands () {
    const info = await this.request({
      method: 'GET',
      path: ['_info']
    })
    return info
  }

  async createIsland (name, opts) {
    await this.request('PUT', ['_create', name], {
      data: opts
    })
    return this.openIsland(name)
  }

  async openIsland (keyOrName) {
    if (this.islands.get(keyOrName)) return this.islands.get(keyOrName)
    const info = await this.request('GET', [keyOrName])
    const island = new Island(this, info)
    this.islands.set(info.name, island)
    this.islands.set(info.key, island)
    return island
  }

  async request (method, path, opts = {}) {
    if (Array.isArray(path)) path = path.join('/')
    if (path.startsWith('/')) path = path.substring(1)
    const url = this.endpoint + path
    const request = {
      method,
      url,
      maxRedirects: 0,
      headers: {
        'content-type': 'application/json',
        ...opts.headers || {}
      },
      // axios has a very weird bug that it REMOVES the
      // Content-Type header if data is empty...
      data: opts.data || {},
      params: opts.params,
      onUploadProgress: opts.onUploadProgress
    }
    debug('request: %s %s', request.method, request.url)

    if (opts.binary) {
      request.headers['content-type'] = 'application/octet-stream'
    }
    if (opts.stream) {
      request.responseType = 'stream'
    }

    try {
      debug('request: %s %s params %o', request.method, request.url, request.params)
      const result = await axios.request(request)
      debug('response: %s %s (length %s)', result.status, result.statusText, result.headers['content-length'])
      return result.data
    } catch (err) {
      const wrappedError = wrapAxiosError(err)
      debug('response: %o', wrappedError.message)
      throw wrappedError
    }
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

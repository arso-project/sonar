const debug = require('debug')('sonar-client')
const randombytes = require('randombytes')
const axios = require('axios')

const Commands = require('./commands')
const Collection = require('./collection')

const {
  DEFAULT_ENDPOINT
} = require('./constants')

module.exports = class Client {
  constructor (opts = {}) {
    this.endpoint = opts.endpoint || DEFAULT_ENDPOINT
    if (!this.endpoint.endsWith('/')) {
      this.endpoint = this.endpoint + '/'
    }
    this._collections = new Map()
    this._id = opts.id || randombytes(16).toString('hex')

    this.commands = new Commands({
      url: this.endpoint + 'commands',
      name: opts.name || 'client:' + this._id
    })
  }

  async close () {
    return this.commands.close()
  }

  async listCollections () {
    const info = await this.request('GET', '_info')
    return info.collections
  }

  async createCollection (name, opts) {
    await this.request('PUT', ['_create', name], {
      data: opts
    })
    return this.openCollection(name)
  }

  // TODO: Move to Collection.update()?
  async updateCollection (name, info) {
    return this._request('PATCH', name, {
      data: info
    })
  }

  async openCollection (keyOrName) {
    if (this._collections.get(keyOrName)) return this._collections.get(keyOrName)
    const collection = new Collection(this, keyOrName)
    // This will throw if the collection does not exist.
    await collection.open()
    this._collections.set(collection.name, collection)
    this._collections.set(collection.key, collection)
    return collection
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

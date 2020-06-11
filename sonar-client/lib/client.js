const debug = require('debug')('sonar-client')
const randombytes = require('randombytes')
const axios = require('axios')
const fetch = require('isomorphic-fetch')

const Commands = require('./commands')
const Collection = require('./collection')

const {
  DEFAULT_ENDPOINT
} = require('./constants')

module.exports = class Client {
  constructor (opts = {}) {
    this.endpoint = opts.endpoint || DEFAULT_ENDPOINT
    if (this.endpoint.endsWith('/')) {
      this.endpoint = this.endpoint.substring(0, this.endpoint.length - 1)
    }
    this._collections = new Map()
    this._id = opts.id || randombytes(16).toString('hex')

    this.commands = new Commands({
      url: this.endpoint + '/_commands',
      name: opts.name || 'client:' + this._id
    })
  }

  async close () {
    return this.commands.close()
  }

  async listCollections () {
    const info = await this.fetch('/_info')
    return info.collections
  }

  async createCollection (name, opts) {
    await this.fetch(`/_create/${name}`, {
      method: 'PUT',
      body: opts
    })
    return this.openCollection(name)
  }

  // TODO: Move to Collection.update()?
  async updateCollection (name, info) {
    return this.fetch(name, {
      method: 'PATCH',
      body: info
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

  async fetch (path, opts) {
    return this.fetchFetch(path, opts)
  }

  async fetchFetch (path, opts = {}) {
    if (!path.startsWith('/')) path = '/' + path
    let url = this.endpoint + path

    if (!opts.headers) opts.headers = {}
    if (!opts.requestType) {
      if (Buffer.isBuffer(opts.body)) opts.requestType = 'buffer'
      else opts.requestType = 'json'
    }

    if (opts.params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(opts.params)) {
        searchParams.append(key, value)
      }
      url += '?' + searchParams.toString()
    }

    if (opts.requestType === 'json') {
      opts.body = JSON.stringify(opts.body)
      opts.headers['content-type'] = 'application/json'
    }
    if (opts.requestType === 'buffer') {
      opts.headers['content-type'] = 'application/octet-stream'
    }

    try {
      debug('fetch', url, opts)
      const res = await fetch(url, opts)
      if (!res.ok) {
        let message
        if (isJsonResponse(res)) {
          message = (await res.json()).error
        } else {
          message = await res.text()
        }
        throw new Error('Remote error (code ' + res.status + '): ' + message)
      }

      if (opts.responseType === 'stream') {
        return res.body
      }
      if (opts.responseType === 'buffer') {
        if (res.buffer) return await res.buffer()
        else return await res.arrayBuffer()
      }

      if (isJsonResponse(res)) {
        return await res.json()
      }

      return await res.text()
    } catch (err) {
      debug('fetch error', err)
      throw err
    }
  }

  async fetchAxios (path, opts = {}) {
    if (Array.isArray(path)) path = path.join('/')
    if (!path.startsWith('/')) path = '/' + path
    const url = this.endpoint + path
    const request = {
      method: opts.method,
      url,
      maxRedirects: 0,
      headers: {
        'content-type': 'application/json',
        ...opts.headers || {}
      },
      // axios has a very weird bug that it REMOVES the
      // Content-Type header if data is empty...
      data: opts.body || {},
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

function isJsonResponse (res) {
  const header = res.headers.get('content-type')
  if (!header) return false
  return header.indexOf('application/json') !== -1
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

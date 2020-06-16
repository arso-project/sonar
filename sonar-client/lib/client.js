const debug = require('debug')('sonar-client')
const randombytes = require('randombytes')
const fetch = require('isomorphic-fetch')

const Commands = require('./commands')
const Collection = require('./collection')

const {
  DEFAULT_ENDPOINT
} = require('./constants')

class Client {
  /**
   * Creates a new Client to communicate with a Sonar server.
   *
   * @constructor
   * @param {object} [opts] - Optional options.
   * @param {string} [opts.endpoint=http://localhost:9191/api] - The API endpoint to talk to.
   * @param {string} [opts.id] - The id for this client. Random by default. Used for for cache ids.
   * @param {string} [opts.name] - The name of this client. Only relevant if using persistent commands (for bots).
   */
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

  /**
   * Closes the client and all commands that maybe active.
   *
   * @async
   * @return {Promise}
   */
  async close () {
    return this.commands.close()
  }

  /**
   * Get a list of all collections available on this server.
   *
   * @async
   * @return {Promise.<object[]>} Promise that resolves to an array of collection info objects.
   */
  async listCollections () {
    const info = await this.fetch('/_info')
    return info.collections
  }

  /**
   * Creates a collection with name name on the Sonar server. The name may not contain whitespaces. opts is an optional object with:
   *
   * @async
   * @param {string} name - Name of the new collection, may not contain whitespaces.
   * @param {object} [opts] - Optional options object.
   * @param {string} [opts.key] - Hex string of an existing collection. Will then sync this collection instead of creating a new, empty collection.
   * @param {string} [opts.alias] - When setting key, alias is required and is your nick name within this collection.
   * @return {Promise<Collection>} The created collection.
   */
  async createCollection (name, opts) {
    await this.fetch(`/_create/${name}`, {
      method: 'PUT',
      body: opts
    })
    return this.openCollection(name)
  }

  // TODO: Move to Collection.update()?
  // TODO: info == config?
  /**
   * Updates the config of a collection.
   *
   * @async
   * @param {string} name - Name of the collection.
   * @param {object} info - [TODO:description]
   * @param {boolean} info.share - Controls whether a collection is shared via p2p.
   * @return {Promise}
   */
  async updateCollection (name, info) {
    return this.fetch(name, {
      method: 'PATCH',
      body: info
    })
  }

  /**
   * Returns a Collection object for a given key or name of a collection.
   *
   * @async
   * @param {string} keyOrName - Key or name of the collection to open/return.
   * @return {Promise<Collection>} 
   */
  async openCollection (keyOrName) {
    if (this._collections.get(keyOrName)) return this._collections.get(keyOrName)
    const collection = new Collection(this, keyOrName)
    // This will throw if the collection does not exist.
    await collection.open()
    this._collections.set(collection.name, collection)
    this._collections.set(collection.key, collection)
    return collection
  }

  async fetch (url, opts = {}) {
    if (!url.match(/^https?:\/\//)) {
      if (url.indexOf('://') !== -1) throw new Error('Only http: and https: protocols are supported.')
      if (!url.startsWith('/')) url = '/' + url
      if (opts.endpoint) url = opts.endpoint + url
      else url = this.endpoint + url
    }

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
}

function isJsonResponse (res) {
  const header = res.headers.get('content-type')
  if (!header) return false
  return header.indexOf('application/json') !== -1
}

module.exports = Client

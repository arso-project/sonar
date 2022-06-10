import EventSource from 'eventsource'
import type { EventSourceInitDict } from 'eventsource'
import { EventEmitter } from 'events'
import makeFetch, { FetchOpts } from './fetch.js'
import { Collection } from './collection.js'
import { Bots } from './bots.js'
import type { Logger } from '@arsonar/common'
import { createLogger } from '@arsonar/common'
import { DEFAULT_ENDPOINT, DEFAULT_WORKSPACE } from './constants.js'
function defaultWorkspace (): string {
  return (process && process.env && process.env.WORKSPACE) || DEFAULT_WORKSPACE
}

export interface CreateCollectionOpts {
  key?: string
  name?: string,
  alias?: string
}

export interface CollectionConfig {
  share: boolean
}

export interface OpenCollectionOpts {
  reset?: boolean
}

export interface EventSourceOpts {
  endpoint?: string
  token?: string
  onmessage?: (event: any) => void
  onerror?: (error: any) => void

  withCredentials?: boolean | undefined
  headers?: object | undefined
  proxy?: string | undefined
  https?: object | undefined
  rejectUnauthorized?: boolean | undefined
}

export interface WorkspaceOpts {
  workspace?: string
  endpoint?: string
  url?: string
  token?: string
  accessCode?: string
  id?: string
  log?: Logger
}

export class Workspace extends EventEmitter {
  endpoint: string
  log: Logger
  bots: Bots
  opened: boolean = false

  private _collections: Map<string, Collection>
  private _token?: string
  private _accessCode?: string
  private _eventSources: EventSource[]
  private _openPromise?: Promise<void>

  /**
     * A Sonar workspace. Provides methods to open collection under this endpoint.
     *
     * @constructor
     * @param {object} [opts] - Optional options.
     * @param {string} [opts.url=http://localhost:9191/api/v1/default] - The API endpoint to talk to.
     * @param {string} [opts.accessCode] - An access code to login at the endpoint.
     * @param {string} [opts.token] - A JSON web token to authorize to the endpoint.
     * @param {string} [opts.name] - The name of this client.
     */
  constructor (opts: WorkspaceOpts = {}) {
    super()
    if (opts.endpoint) {
      const workspace = opts.workspace || defaultWorkspace()
      const endpoint = opts.endpoint || DEFAULT_ENDPOINT
      this.endpoint = `${endpoint}/${workspace}`
    } else if (opts.url) {
      this.endpoint = opts.url
      // TODO: deprecate, ue only URL.
    } else {
      this.endpoint = DEFAULT_ENDPOINT
    }
    if (this.endpoint.endsWith('/')) {
      this.endpoint = this.endpoint.substring(0, this.endpoint.length - 1)
    }
    this._collections = new Map()
    this._token = opts.token
    this._accessCode = opts.accessCode
    this._eventSources = []
    this.log = opts.log || createLogger({})
    this.bots = new Bots(this)
  }

  get token () {
    return this._token
  }

  /**
     * Closes the client.
     */
  async close (): Promise<void> {
    for (const eventSource of this._eventSources) {
      eventSource.close()
    }
    for (const collection of this._collections.values()) {
      collection.close()
    }
  }

  /**
     * Closes the client.
     */
  async open (): Promise<void> {
    if (this.opened) {
      return
    }
    if (!this._openPromise) {
      this._openPromise = this._open()
    }
    await this._openPromise
  }

  private async _open () {
    await this._login()
    this.opened = true
  }

  // TODO: Support re-logins
  private async _login () {
    if (this._accessCode && !this._token) {
      const res = await this.fetch('/login', {
        params: { code: this._accessCode },
        method: 'POST',
        opening: true
      })
      const token = res.token
      this._token = token
    }
  }

  /**
     * Get a list of all collections available on this endpoint.
     *
     * @async
     * @return {Promise.<object[]>} Promise that resolves to an array of collection info objects.
     */
  async listCollections () {
    const info = await this.fetch('/')
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
  async createCollection (name: string, opts: CreateCollectionOpts = {}) {
    opts.name = name
    await this.fetch('/collection', {
      method: 'POST',
      body: opts
    })
    const collection = await this.openCollection(name, { reset: true })
    return collection
  }

  /**
     * Updates the config of a collection.
     *
     * @async
     * @param {string} name - Name of the collection.
     * @param {object} info - [TODO:description]
     * @param {boolean} info.share - Controls whether a collection is shared via p2p.
     * @return {Promise<void>}
     */
  async updateCollection (name: string, config: CollectionConfig): Promise<CollectionConfig> {
    return await this.fetch('/collection/' + name, {
      method: 'PATCH',
      body: config
    })
  }

  /**
     * Returns a Collection object for a given key or name of a collection.
     *
     * @async
     * @param {string} keyOrName - Key or name of the collection to open/return.
     * @return {Promise<Collection>}
     */
  async openCollection (keyOrName: string, opts: OpenCollectionOpts = {}): Promise<Collection> {
    if (this._collections.has(keyOrName)) {
      const collection = this._collections.get(keyOrName)!
      // if (!collection.opened) { await collection.open(opts.reset) }
      return collection
    }
    // This will throw if the collection does not exist.
    const collection = await Collection.open(this, keyOrName)
    this._collections.set(collection.name, collection)
    this._collections.set(keyOrName, collection)
    if (collection.key) this._collections.set(collection.key, collection)
    this.emit('collection-open', collection)
    return collection
  }

  getCollection (keyOrName: string) {
    return this._collections.get(keyOrName)
  }

  getAuthHeaders (opts: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {}
    const token = this._token || opts.token
    if (token) {
      headers.authorization = 'Bearer ' + token
    }
    return headers
  }

  getHeaders (): Record<string, string> {
    return this.getAuthHeaders()
  }

  /**
     * Fetch a resource.
     *
     * This is a wrapper around the fetch web API. It should be API compatible to fetch,
     * with the following changes:
     *
     * @async
     * @param {string} [opts.requestType='json'] Request encoding and content type.
     *   Supported values are 'json' and 'binary'
     * @param {string} [opts.responseType='text'] Response encoding. If the response
     *    has a JSON content type, will always be set to 'json'.
     *    Supported values are 'text', 'binary' and 'stream'.
     * @param {object} [opts.params] Query string parameters (will be encoded correctly).
     *
     * @return {Promise<object>} If the response has a JSON content type header, the
     *    decoded JSON will be returned. if opts.responseType is 'binary' or 'text',
     *    the response will be returned as a buffer or text.
     *
     * TODO: Rethink the default responseType cascade.
     */
  async fetch (url: string, opts: FetchOpts = {}) {
    if (!this.opened && !opts.opening) {
      await this.open()
    }
    if (!opts.endpoint && this.endpoint) {
      opts.endpoint = this.endpoint
    }
    if (!opts.headers) { opts.headers = {} }
    const authOpts: Record<string, string> = {}
    if (opts.token) authOpts.token = opts.token
    opts.headers = {
      ...opts.headers || {},
      ...this.getAuthHeaders(authOpts)
    }
    opts.log = message => this.log.debug({ message, name: 'fetch' })
    return makeFetch(url, opts)
  }

  createEventSource (path: String, opts: EventSourceOpts = {}): EventSource {
    if (!opts.endpoint && this.endpoint) { opts.endpoint = this.endpoint }
    opts.headers = { ...(opts.headers || {}), ...this.getHeaders() }
    const stringUrl = (opts.endpoint || '') + path
    const url = new URL(stringUrl)
    const token = this._token || opts.token
    if (token) {
      url.searchParams.set('token', token)
    }
    const eventSource = new EventSource(url.toString(), opts)
    eventSource.addEventListener('message', message => {
      try {
        const event = JSON.parse(message.data)
        if (opts.onmessage) opts.onmessage(event)
      } catch (e) { }
    })
    eventSource.addEventListener('error', err => {
      // TODO: Where do these errors go?
      // TODO: After a couple of fails die.
      if (opts.onerror) { opts.onerror(err) } else { console.error('Event source error', err) }
    })
    this._eventSources.push(eventSource)
    return eventSource
  }
}

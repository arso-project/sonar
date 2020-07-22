const base32Encode = require('base32-encode')
const randomBytes = require('randombytes')
const { Readable } = require('streamx')
const EventSource = require('eventsource')

const Schema = require('@arso-project/sonar-common/schema')
const Fs = require('./fs')
const Resources = require('./resources')

function uuid () {
  return base32Encode(randomBytes(16), 'Crockford').toLowerCase()
}

class Collection {
  static uuid () {
    return uuid()
  }

  /**
   * Create a collection instance
   *
   * @constructor
   * @param {Client} client - A client instance.
   * @param {string} name - Name of the collection.
   * @return {Collection}
   */
  constructor (client, name) {
    this.endpoint = client.endpoint + '/collection/' + name
    this._client = client
    this._info = {}
    this._name = name
    this._eventStreams = new Set()

    this.fs = new Fs(this)
    this.resources = new Resources(this)
  }

  get name () {
    if (this._info) return this._info.name
    return this._name
  }

  get key () {
    return this._info && this._info.key
  }

  get localKey () {
    return this._info && this._info.localKey
  }

  get info () {
    return this._info
  }

  /**
   * Populates info and schemas for this collection from server.
   *
   * @async
   * @throws Will throw if this collection does not exist or cannot be accessed.
   * @return {Promise<void>}
   */
  async open () {
    this._info = await this.fetch('/')

    this.schema = new Schema()
    this.schema.setDefaultNamespace(this.key)

    const typeSpecs = await this.fetch('/schema')
    for (const typeSpec of Object.values(typeSpecs)) {
      this.schema.addType(typeSpec)
    }
  }

  async close () {
    for (const stream of this._eventStreams) {
      stream.destroy()
    }
    if (this._eventSource) this._eventSource.close()
  }

  /**
   * Add a new feed to the collection.
   *
   * @async
   * @param {string} key - The hex-encoded key of the feed to add.
   * @param {object} [info] - Optional information about the feed.
   *                          TODO: Document
   */
  async addFeed (key, info = {}) {
    return this.fetch('/feed/' + key, {
      method: 'PUT',
      body: info
    })
  }

  /**
   * Query the database. Returns an array of matching records.
   * Records may have a meta property that includes query-specific metadata (e.g. the score for search queries).
   *
   * @async
   * @param {string} name - The name of a supported query. Options at the moment are search, records, history and indexes.
   * @param {object} args - The arguments for the query. Depends on the query being used.
   *                         For records: { schema, name, id }
   *                         For history: { from: timestamp, to: timestamp }
   *                         For search: Either a "string" for a simple full-text search, or an tantivy query object (to be documented)
   *                         For indexes: { schema, prop, value, from, to, reverse, limit } (to be documented)
   * @param {object} [opts] - Optional options
   * @param {boolean} [opts.waitForSync=false] Wait for all pending indexing operations to be finished.
   * @return {Promise<Array<object>>} A promise that resolves to an array of record objects.
   */
  async query (name, args, opts) {
    if (this._cacheid) {
      opts.cacheid = this._cacheid
    }

    let records = await this.fetch('/query/' + name, {
      method: 'POST',
      body: args,
      params: opts
    })

    records = records.map(record => this.schema.Record(record))

    // if (this._cacheid) {
    //   return this._cache.batch(records)
    // }

    return records
  }

  /**
   * Put a new record into the database.
   *
   * @async
   * @param {object} record - The record.
   * @param {string} record.schema - The schema of the record.
   * @param {string} [record.id] - The entity id of the record. If empoty an id will be created.
   * @param {object} record.value - Value of the record.
   * @throws Throws if the record is invalid.
   * @return {Promise<object>} An object with an `{ id }` property.
   */
  async put (record) {
    if (!record.id) record.id = uuid()
    record = this.schema.Record(record)
    return this.fetch('/db', {
      method: 'PUT',
      body: record
    })
  }

  /**
   * Get records by schema and id. Returns an array of matching records.
   *
   * @async
   * @param {object} req - The get request. Should either be `{ schema, id }` or `{ key, seq }`.
   * @param {object} [opts] - Optional options.
   * @param {boolean} [opts.waitForSync=false] Wait for all pending indexing operations to be finished.
   * @return {Promise<Array<object>>} A promise that resolves to an array of record objects.
   */
  async get (req, opts) {
    // TODO: Implement RecordCache.has
    // if (this._cache.has(req)) {
    //   return this._cache.get(req)
    // }
    return this.query('records', req, opts)
  }

  /**
   * Deletes a record.
   *
   * @async
   * @param {object} record - The record to delete. Has to have `{ id, schema }` properties set.
   * @return {Promise<object>} - An object with `{ id, schema }` properties of the deleted record.
   */
  async del (record) {
    return this.fetch('/db/' + record.id, {
      method: 'DELETE',
      params: { type: record.type }
    })
  }

  /**
   * Adds a new type to the collection.
   *
   * @async
   * @param {object} schema - A schema object.
   * @throws Throws if the schema object is invalid or cannot be saved.
   * @return {Promise<object>} A promise that resolves to the saved schema object.
   */
  async putType (spec) {
    const type = this.schema.addType(spec)
    return this.fetch('/schema', {
      method: 'POST',
      body: type.toJSONSchema()
    })
  }

  /**
   * Wait for all pending indexing operations to be finished.
   *
   * @async
   * @return {Promise<void>}
   */
  async sync () {
    return this.fetch('/sync')
  }

  /**
   * Subscribe to events on this collection.
   *
   * Returned events look like this: `{ event, data, id }`
   * Events are:
   *
   * * `update`: with `{ lseq }`
   * * `feed`: with `{ key }`
   * * `schema-update`
   *
   * @return {Readable<object>}
   */
  createEventStream () {
    const stream = new Readable()
    this._eventStreams.add(stream)
    if (!this._eventSource) this._initEventSource()
    return stream
  }

  async _initEventSource () {
    try {
      if (!this._client.opened) await this._client.open()
      const headers = this._client.getAuthHeaders()
      const path = this.endpoint + '/events'
      this._eventSource = new EventSource(path, { headers })
      this._eventSource.addEventListener('message', message => {
        try {
          const event = JSON.parse(message.data)
          for (const stream of this._eventStreams) {
            stream.push(event)
          }
        } catch (e) {}
      })
    } catch (e) {
      // TODO: Where should the error go?
      console.error('Error initializing event source: ' + e.message)
    }
    return this._eventSource
  }

  /**
   * Subscribe to this collection.
   *
   * This will fetch all records from the first to the last and then waits for new records.
   * Currently only intended for usage in bots (not in short-running Browser clients).
   *
   * @todo: Prefix client ID to subscription name.
   * @todo: Allow to subscribe from now instead of from the beginning.
   *
   * @param {string} Subscription name. Has to be unique per running Sonar instance
   * @param {function} Async callback function that will be called for each incoming record
   */
  async subscribe (name, onRecord) {
    const self = this

    run().catch(err => {
      // TODO: How to deal with these errors?
      console.error('subscription error', err)
    })

    return true

    async function run () {
      const eventStream = self.createEventStream()
      while (true) {
        const incomingEvent = new Promise((resolve, reject) => {
          eventStream.on('data', ondata)
          eventStream.once('error', reject)
          function ondata (event) {
            if (event.type === 'update') {
              eventStream.removeEventListener('data', ondata)
              eventStream.removeEventListener('error', reject)
              resolve()
            }
          }
        })

        const batch = await self._pullSubscription(name)
        for (const message of batch.messages) {
          await onRecord(message)
          // TODO: Do we want to ack for each message or for each batch?
          // Likely let the subscriber decide.
          self._ackSubscription(name, message.lseq)
        }
        if (batch.finished) {
          await incomingEvent
        }
      }
    }
  }

  async _pullSubscription (name, opts) {
    // TODO: Prefix name with client id.
    return this.fetch('/subscription/' + name, {
      query: opts
    })
  }

  async _ackSubscription (name, cursor) {
    // TODO: Prefix name with client id.
    return this.fetch('/subscription/' + name + '/' + cursor, {
      method: 'post'
    })
  }

  async fetch (path, opts = {}) {
    if (!opts.endpoint) opts.endpoint = this.endpoint
    return this._client.fetch(path, opts)
  }
}

module.exports = Collection

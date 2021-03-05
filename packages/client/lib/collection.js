const base32Encode = require('base32-encode')
const randomBytes = require('randombytes')
const debug = require('debug')('sonar-client')
const { Readable, Writable, Transform } = require('streamx')
const { EventEmitter } = require('events')

const Schema = require('@arsonar/common/schema')
const Fs = require('./fs')
const Resources = require('./resources')

function uuid () {
  return base32Encode(randomBytes(16), 'Crockford').toLowerCase()
}

class Collection extends EventEmitter {
  static uuid () {
    return uuid()
  }

  /**
   * Remote collection
   *
   * @constructor
   * @param {Workspace} workspace - Remote workspace
   * @param {string} nameOrKey - Name or key of the collection
   * @return {Collection}
   */
  constructor (client, nameOrKey) {
    super()
    this.endpoint = client.endpoint + '/collection/' + nameOrKey
    this._client = client
    this._info = {}
    this._nameOrKey = nameOrKey
    this._eventStreams = new Set()

    this.fs = new Fs(this)
    this.resources = new Resources(this)
    this.log = client.log.child({ collection: this })
  }

  get name () {
    if (this._info) return this._info.name
    return this._nameOrKey
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

  get id () {
    return this._info && this._info.id
  }

  /**
   * Populate info and schemas for this collection from server.
   *
   * @async
   * @throws Will throw if this collection does not exist or cannot be accessed.
   * @return {Promise<void>}
   */
  async open () {
    this._info = await this.fetch('/')

    this.schema = new Schema()
    this.schema.setDefaultNamespace(this.id)

    const typeSpecs = await this.fetch('/schema')
    for (const typeSpec of Object.values(typeSpecs)) {
      this.schema.addType(typeSpec)
    }
  }

  /**
   * Close the collection.
   *
   * Properly closes open HTTP requests.
   * @async
   */
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
   * Query the collection.
   *
   * Returns an array of matching records.
   *
   * Records may have a meta property that includes query-specific metadata (e.g. the score for search queries).
   *
   * @async
   * @param {string} name - The name of a supported query.
   *                        Supported queries that ship with @arsonar/core are:
   *                        records, search, relations, history and indexes.
   * @param {object} args - The arguments for the query. Depends on the query being used.
   *                        For records: `{ schema, name, id }`
   *                        For history: `{ from: timestamp, to: timestamp }`
   *                        For search: Either a "string" for a simple full-text search, or a
   *                           tantivy query object.
   *                        For indexes: `{ schema, prop, value, from, to, reverse, limit }`
   *                           (to be documented)
   *                        For relations: `{ subject, object, predicate }`
   *                           where subject and object are ids and predicate is `type#field`
   *
   * @param {object} [opts] - Optional options
   * @param {boolean} [opts.sync=false] Wait for all pending indexing operations to be finished.
   *
   * @return {Promise<Array<Record>>} A promise that resolves to an array of record objects.
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

    for (const key of records.keys()) {
      const record = records[key]
      try {
        records[key] = this.schema.Record(record)
      } catch (err) {
        // TODO: Where should these errors go
        console.error('Error when upcasting record', err)
        console.error('Record: ', record)
        records[key] = null
      }
    }
    records = records.filter(r => r)

    // if (this._cacheid) {
    //   return this._cache.batch(records)
    // }

    return records
  }

  /**
   * Put a new record into the collection.
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
    // If the record has no id set (= is a new record), generate and add a random id.
    if (!record.id) record.id = uuid()
    // This checks if the record has type, id, value set and if the type is present
    // in the collection's schema. Throws an error if not.
    // TODO: Add feature to @arsonar/common to validate the record's value against the schema.
    record = this.schema.Record(record)
    return this.fetch('/db', {
      method: 'PUT',
      body: record
    })
  }

  /**
   * Get records by their semantic address (type and id) or by their storage address (key and seq).
   *
   * @async
   * @param {object} req - The get request. Either `{ type, id }` or `{ key, seq }`.
   * @param {object} [opts] - Optional options.
   * @param {boolean} [opts.sync=false] Wait for all pending indexing operations to be finished.
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
   * @param {object} record - The record to delete. Has to have `{ id, type }` properties set.
   * @return {Promise<object>} - An object with `{ id, type }` properties of the deleted record.
   */
  async del (record) {
    return this.fetch('/db/' + record.id, {
      method: 'DELETE',
      params: { type: record.type }
    })
  }

  /**
   * Add a new type to the collection.
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
      body: type.toJSON()
    })
  }

  /**
   * Create a writable stream to put records into the collection.
   *
   * Example:
   * ```javascript
   * const batchStream = collection.createBatchStream()
   * batch.write(record)
   * batch.close()
   * ```
   *
   * @return {Writable<Record>} A writable stream
   */
  createBatchStream () {
    const self = this
    const stream = new Transform({
      open (cb) {
        stream.finished = self.fetch('/db', {
          method: 'PUT',
          requestType: 'stream',
          headers: {
            'content-type': 'application/x-ndjson'
          },
          params: { batch: true },
          body: this
        }).catch(err => stream.destroy(err))
        cb()
      },
      transform (record, cb) {
        if (!record.id) record.id = uuid()
        record = self.schema.Record(record)
        const json = JSON.stringify(record)
        this.push(json + '\n')
        cb()
      }
    })
    return stream
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
   * Returns a readable stream that emits event objects.
   * They look like this:
   * `{ event: string, data: object }`
   *
   * Events are:
   *
   * * `update`: with data `{ lseq }`
   * * `feed`: with data `{ key }`
   * * `schema-update`
   *
   * @return {Readable<object>}
   */
  createEventStream () {
    if (!this._eventStream) {
      this._initEventSource()
    }
    return this._eventStream.subscribe()
  }

  async _initEventSource () {
    if (this._eventStream) return
    this._eventStream = new TeeStream()

    const onerror = err => {
      // TODO: Where should the error go?
      this.log.error('Error initializing event source: ' + err.message)
      if (this._eventStream) this._eventStream.destroy(err)
      this._eventStream = null
    }

    try {
      if (!this._client.opened) await this._client.open()
    } catch (err) {
      onerror(err)
      return
    }

    this._eventSource = this._client.createEventSource('/events', {
      endpoint: this.endpoint,
      onerror,
      onmessage: (eventObject) => {
        this.log.trace('event: ' + eventObject.event)
        this._eventStream.write(eventObject)
        this.emit(eventObject.event, eventObject.data)
      }
    })
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
    await this._initEventSource()

    run().catch(err => {
      // TODO: How to deal with these errors?
      this.log.error('subscription error', err)
    })

    return true

    async function run () {
      // const eventStream = self.createEventStream()
      while (true) {
        // wait for one incoming update event
        const nextUpdatePromise = new Promise((resolve, reject) => {
          self.once('update', resolve)
        })

        const batch = await self._pullSubscription(name)
        for (const message of batch.messages) {
          try {
            const record = self.schema.Record(message)
            await onRecord(record)
            // TODO: Do we want to ack for each message or for each batch?
            // Likely let the subscriber decide.
            await self._ackSubscription(name, message.lseq)
          } catch (err) {
            // TODO: What to do with errors here?
            self.log.error(`Error in subscription ${name}: ${err.message}`)
            debug(err)
            // TODO: This will easily cause an endless loop becaues it'll
            // just keep refreshing and running into errors ;-)
          }
        }
        if (batch.finished) {
          await nextUpdatePromise
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

  /**
   * Reindex the secondary indexes (views) in this collection.
   *
   * Use with care, this can be expensive.
   *
   * @param {Array<string>} Optional array of view names to reindex.
   *  If unset all views will be reindexed.
   */
  async reindex (views) {
    return this.fetch('/reindex', {
      method: 'post',
      params: { views }
    })
  }

  async fetch (path, opts = {}) {
    if (!opts.endpoint) opts.endpoint = this.endpoint
    return this._client.fetch(path, opts)
  }
}

class TeeStream extends Writable {
  constructor (opts) {
    super(opts)
    this._streams = new Set()
  }

  subscribe (opts) {
    const stream = new Readable(opts)
    stream.on('destroy', () => this._streams.remove(stream))
    this._streams.add(stream)
    return stream
  }

  _write (data, cb) {
    for (const stream of this._streams) {
      stream.push(data)
    }
    cb()
  }

  _destroy (err) {
    for (const stream of this._streams) {
      stream.destroy(err)
    }
    super.destroy(err)
  }
}

module.exports = Collection

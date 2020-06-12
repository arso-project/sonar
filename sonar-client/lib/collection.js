const RecordCache = require('./record-cache')
const Schema = require('./schema')
const Fs = require('./fs')
const Resources = require('./resources')

class Collection {
  /**
   * Create a collection instance
   *
   * @constructor
   * @param {Client} client - A client instance.
   * @param {string} name - Name of the collection.
   * @return {Collection}
   */
  constructor (client, name) {
    this.endpoint = client.endpoint + '/' + name
    this._client = client
    this._info = {}
    this._name = name
    this._cache = new RecordCache()

    this.schema = new Schema()
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

  /**
   * Populates info and schemas for this collection from server.
   *
   * @async
   * @throws Will throw if this collection does not exist or cannot be accessed.
   * @return {Promise}
   */
  async open () {
    const info = await this.fetch('/')
    this._info = info
    const schemas = await this.fetch('/schema')
    this.schema.add(schemas)
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

    const records = await this.fetch('/query/' + name, {
      method: 'POST',
      body: args,
      params: opts
    })

    if (this._cacheid) {
      return this._cache.batch(records)
    }

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
   * @return {Promise<object> - An object with `{ id, schema }` properties of the deleted record.
   */
  async del (record) {
    return this.fetch('/db/' + record.id, {
      method: 'DELETE',
      params: { schema: record.schema }
    })
  }

  /**
   * Adds a new schema to the collection.
   *
   * @async
   * @param {object} schema - A schema object.
   * @throws Throws if the schema object is invalid or cannot be saved.
   * @return {Promise<object>} A promise that resolves to the saved schema object.
   */
  async putSchema (schema) {
    return this.fetch('/schema', {
      method: 'POST',
      body: schema
    })
  }

  /**
   * Wait for all pending indexing operations to be finished.
   *
   * @async
   * @return {Promise}
   */
  async sync () {
    return this.fetch('/sync')
  }

  async fetch (path, opts = {}) {
    if (!opts.endpoint) opts.endpoint = this.endpoint
    return this._client.fetch(path, opts)
  }
}

module.exports = Collection

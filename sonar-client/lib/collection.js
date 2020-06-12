const RecordCache = require('./record-cache')
const Schema = require('./schema')
const Fs = require('./fs')
const Resources = require('./resources')

module.exports = class Collection {
  /**
   * Create a collection instance 
   *
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
   * @return {Promise<[TODO:type]>} [TODO:description]
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
   * @param {object} opts - [TODO:description]
   * @return {Promise<[TODO:type]>} [TODO:description]
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
   * @return {Promise<[TODO:type]>} [TODO:description]
   */
  async put (record) {
    return this.fetch('db', {
      method: 'PUT',
      body: record
    })
  }

  /**
   * Get records by schema and id. Returns an array of matching records.
   *
   * @async
   * @param {[TODO:type]} req - [TODO:description]
   * @param {[TODO:type]} opts - [TODO:description]
   * @return {Promise<[TODO:type]>} [TODO:description]
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
   * @param {[TODO:type]} record - [TODO:description]
   * @return {Promise<[TODO:type]>} [TODO:description]
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
   * @param {object} schema - [TODO:description]
   * @return {Promise<[TODO:type]>} [TODO:description]
   */
  async putSchema (schema) {
    return this.fetch('/schema', {
      method: 'POST',
      body: schema
    })
  }

  /**
   * [TODO:description]
   *
   * @async
   * @return {Promise<[TODO:type]>} [TODO:description]
   */
  async sync () {
    return this.fetch('/sync')
  }

  async fetch (path, opts = {}) {
    if (!opts.endpoint) opts.endpoint = this.endpoint
    return this._client.fetch(path, opts)
  }
}

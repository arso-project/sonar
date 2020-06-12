const RecordCache = require('./record-cache')
const Schema = require('./schema')
const Fs = require('./fs')
const Resources = require('./resources')

module.exports = class Collection {
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

  async open () {
    const info = await this.fetch('/')
    this._info = info
    const schemas = await this.fetch('/schema')
    this.schema.add(schemas)
  }

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

  async put (record) {
    return this.fetch('db', {
      method: 'PUT',
      body: record
    })
  }

  async get (req, opts) {
    // TODO: Implement RecordCache.has
    // if (this._cache.has(req)) {
    //   return this._cache.get(req)
    // }
    return this.query('records', req, opts)
  }

  async del (record) {
    return this.fetch('/db/' + record.id, {
      method: 'DELETE',
      params: { schema: record.schema }
    })
  }

  async putSchema (schema) {
    return this.fetch('/schema', {
      method: 'POST',
      body: schema
    })
  }

  async sync () {
    return this.fetch('/sync')
  }

  async fetch (path, opts = {}) {
    if (!opts.endpoint) opts.endpoint = this.endpoint
    return this._client.fetch(path, opts)
  }
}

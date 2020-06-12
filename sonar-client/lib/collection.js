const RecordCache = require('./record-cache')
const Schema = require('./schema')
const Fs = require('./fs')

module.exports = class Collection {
  constructor (client, name) {
    this._client = client
    this._info = {}
    this._cache = new RecordCache()
    this._schema = new Schema()
    this._fs = new Fs(this)
    this._name = name
  }

  get fs () {
    return this._fs
  }

  get schema () {
    return this._schema
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
    this._schema.add(schemas)
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

  async fetch (path, opts) {
    if (!path.startsWith('/')) path = '/' + path
    path = '/' + this._name + path
    return this._client.fetch(path, opts)
  }
}

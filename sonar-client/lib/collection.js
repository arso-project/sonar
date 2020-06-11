const RecordCache = require('./record-cache')
const Schema = require('./schema')
const Fs = require('./fs')

module.exports = class Collection {
  constructor (client, name) {
    this._client = client
    this._info = {}
    this._cache = new RecordCache()
    this._schema = new Schema()
    this._fs = new Fs(client, name)
    this._name = name
  }

  get name () {
    return this._name
  }

  get key () {
    return this._info && this._info.key
  }

  async open () {
    const info = await this.request('GET', '')
    this._info = info
    const schemas = await this.request('GET', 'schema')
    this._schema.add(schemas)
  }

  async query (name, args, opts) {
    if (this._cacheid) {
      opts.cacheid = this._cacheid
    }

    const records = await this.request('POST', ['query', name], {
      data: args,
      params: opts
    })

    if (this._cacheid) {
      return this._cache.batch(records)
    }

    return records
  }

  async put (record) {
    return this.request('PUT', 'db', {
      data: record
    })
  }

  async get (req, opts) {
    if (this._cache.has(req)) {
      return this._cache.get(req)
    }
    return this.query('records', req, opts)
  }

  async del (record) {
    this.request('DELETE', ['db', record.id], {
      // type: record.type
      schema: record.schema
    })
  }

  async sync () {
    return this.request('GET', 'sync')
  }

  async request (method, path, opts) {
    if (!Array.isArray(path)) path = [path]
    return this._client.request(method, [this._name, ...path], opts)
  }
}

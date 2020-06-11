const RecordCache = require('./record-cache')
const Schema = require('./schema')

module.exports = class Island {
  constructor (client, info) {
    this._client = client
    this._info = info
    this._name = info.name
    this._cache = new RecordCache()
    this._schema = new Schema()
  }

  async init () {
    const schemas = await this.request('GET', 'schema')
    this._schema.setKey(this._info.key)
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

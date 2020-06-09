const RecordCache = require('./record-cache')

module.exports = class Island {
  constructor (client, info) {
    this.client = client
    this._info = info
    this._name = info.name
    this._cache = new RecordCache()
  }

  async query (name, args, opts) {
    if (this._cacheid) {
      opts.cacheid = this._cacheid
    }

    const records = await this.request('POST', ['_query', name], {
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

  async sync () {
    return this.request('GET', 'sync')
  }

  async request (method, path, opts) {
    if (!Array.isArray(path)) path = [path]
    return this.client.request(method, [this._name, ...path], opts)
  }
}

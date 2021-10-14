const LRU = require('lru-cache')

module.exports = class PromiseCache {
  constructor (opts = {}) {
    this.records = new LRU({
      max: opts.max || 1000
    })
    this.promises = new Map()
    if (opts.key) this._key = opts.key
    if (opts.fetch) this._fetch = opts.fetch
  }

  set (req, record) {
    const key = this._key(req)
    this.records.set(key, record)
    this.promises.delete(key)
  }

  get (req) {
    return this.records.get(this._key(req))
  }

  has (req) {
    return this.records.has(this._key(req))
  }

  hasPending (req) {
    const key = this._key(req)
    return this.records.has(key) || this.promises.has(key)
  }

  async getAsync (req, throwOnMissing = true) {
    const key = this._key(req)
    if (this.records.has(key)) return this.records.get(key)
    if (this.promises.has(key)) {
      const record = await this.promises.get(key)
      return record
    }
    if (throwOnMissing) throw new Error('Record is missing')
    else return null
  }

  async getOrFetch (req, fetchFn) {
    if (this.hasPending(req)) return this.getAsync(req)
    else return this.fetch(req, fetchFn)
  }

  async fetch (req, fetchFn) {
    const key = this._key(req)
    if (!fetchFn && !this._fetch) throw new Error('Missing fetch function')
    if (!fetchFn) fetchFn = this._fetch
    const promise = fetchFn(req)
    this.promises.set(key, promise)
    const record = await promise
    if (record) this.set(req, record)
    return record
  }

  _key (req) {
    return req
  }

  _fetch (req) {
    throw new Error('Missing fetch handler')
  }
}

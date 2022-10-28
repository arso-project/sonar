const LRU = require('lru-cache')

module.exports = class VersionCache {
  constructor (corestore, opts = {}) {
    const { map, cacheSize = 1000 } = opts
    this.corestore = corestore
    this.cache = new LRU({ max: cacheSize })
    this.map = map || (version => version)
    this.pending = new Map()
  }

  async getVersion (key, seq, getOpts = {}) {
    if (!Buffer.isBuffer(key)) key = Buffer.from(key, 'hex')
    const id = keyseq(key, seq)
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }

    if (this.pending.has(id)) {
      await this.pending.get(id)
      return this.getVersion(key, seq, getOpts)
    }

    let ondone
    const promise = new Promise(resolve => (ondone = resolve))
    this.pending.set(id, promise)

    try {
      const version = await this._getVersion(id, key, seq, getOpts)
      this.cache.set(id, version)
      return version
    } finally {
      ondone()
      this.pending.delete(id)
    }
  }

  async _getVersion (id, key, seq, getOpts = {}) {
    const feed = this.corestore.get({ key })
    const rawVersion = await feed.get(seq, getOpts)
    const mappedVersion = this.map(rawVersion, {
      key: key.toString('hex'),
      seq
    })
    return mappedVersion
  }
}

function keyseq (key, seq) {
  key = Buffer.isBuffer(key) ? key.toString('hex') : key
  return key + ':' + seq
}

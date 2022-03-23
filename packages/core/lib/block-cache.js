const LRU = require('lru-cache')

module.exports = class BlockCache {
  constructor (corestore, opts = {}) {
    const { map, cacheSize = 1000 } = opts
    this.corestore = corestore
    this.cache = new LRU({ max: cacheSize })
    this.map = map || (block => block)
    this.pending = new Map()
  }

  async getBlock (key, seq, getOpts = {}) {
    if (!Buffer.isBuffer(key)) key = Buffer.from(key, 'hex')
    const id = keyseq(key, seq)
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }

    if (this.pending.has(id)) {
      await this.pending.get(id)
      return this.getBlock(key, seq, getOpts)
    }

    let ondone
    const promise = new Promise(resolve => (ondone = resolve))
    this.pending.set(id, promise)

    try {
      const block = await this._getBlock(id, key, seq, getOpts)
      this.cache.set(id, block)
      return block
    } finally {
      ondone()
      this.pending.delete(id)
    }
  }

  async _getBlock (id, key, seq, getOpts = {}) {
    const feed = this.corestore.get({ key })
    const rawBlock = await new Promise((resolve, reject) => {
      feed.get(seq, getOpts, (err, block) =>
        err ? reject(err) : resolve(block)
      )
    })
    const mappedBlock = this.map(rawBlock, { key: key.toString('hex'), seq })
    return mappedBlock
  }
}

function keyseq (key, seq) {
  key = Buffer.isBuffer(key) ? key.toString('hex') : key
  return key + ':' + seq
}

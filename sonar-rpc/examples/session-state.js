module.exports = class SessionState {
  constructor () {
    // this.corestore = corestore
    this.collections = new Map()
    this.resources = new Map()
    this.resourceCounter = 0
  }

  createResourceId () {
    return ++this.resourceCounter
  }

  addResource (id, value, dealloc) {
    const res = this.resources.get(id)
    if (res) {
      dealloc()
      throw new Error('Resource already exists: ' + id)
    }
    this.resources.set(id, {
      value,
      dealloc
    })
  }

  hasResource (id) {
    return this.resources.has(id)
  }

  getResource (id) {
    const res = this.resources.get(id)
    if (!res) throw new Error('Invalid resource: ' + id)
    return res.value
  }

  deleteResource (id, noDealloc) {
    const res = this.resources.get(id)
    if (!res) throw new Error('Invalid resource: ' + id)
    if (!noDealloc) res.dealloc()
    this.resources.delete(id)
  }

  hasCollection (id) {
    return this.collections.has(id)
  }

  addCollection (id, collection) {
    if (this.collections.has(id)) throw new Error('Collection already exists in session: ' + id)
    this.collections.set(id, { collection })
  }

  getCollection (id) {
    if (!this.collections.has(id)) throw new Error('Invalid collection: ' + id)
    const { collection } = this.collections.get(id)
    return collection
  }

  deleteCollection (id) {
    if (!this.collections.has(id)) throw new Error('Invalid collection: ' + id)
    // const { collection } = this.collections.get(id)
    this.collections.delete(id)
  }

  deleteAll () {
    for (const { dealloc } of this.resources.values()) {
      dealloc()
    }
    for (const id of this.collections.keys()) {
      this.deleteCollection(id)
    }
    this.resources.clear()
  }
}

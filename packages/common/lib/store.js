module.exports = class Store {
  constructor (opts = {}) {
    this._opts = opts
    this._schema = opts.schema
    this._records = new Map()
    this._entities = new Map()
  }

  records () {
    return Array.from(this._records.values())
  }

  entities () {
    return Array.from(this._entities.values())
  }

  getEntity (id) {
    return this._entities.get(id)
  }

  cacheRecord (record) {
    record = this._schema.Record(record)
    this._records.set(record.path, record)
    if (!this._entities.has(record.id)) {
      const entity = this._schema.Entity([record])
      this._entities.set(entity.id, entity)
    } else {
      const entity = this._entities.get(record.id)
      entity.add(record)
    }
    return record
  }
}

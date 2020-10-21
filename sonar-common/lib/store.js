
module.exports = class Store {
  constructor (schema) {
    this._schema = schema
    this._records = new Map()
    this._entities = new Map()
  }

  records () {
    return Array.from(this._records.values())
  }

  entities () {
    return Array.from(this._entities.values())
  }

  add (record) {
    this._records.set(record.address, record)

    let entity = this._entities.get(record.id)
    if (!entity) entity = this._schema.Entity()
    entity.add(record)
    this._entities.set(entity.address, entity)
  }

  getRecord (address) {
    return this._records.get(address)
  }

  getEntity (address) {
    return this._entities.get(address)
  }
}
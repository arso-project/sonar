const {
  Entity,
  // MissingEntity,
  Record,
  // FieldValue,
  FieldValueList,
  // MissingFieldValue
} = require('./records')

const {
  RECORD
} = require('./symbols')

const Schema = require('./schema')

module.exports = class Store {
  constructor (opts = {}) {
    this._opts = opts
    this._schema = opts.schema || new Schema(opts)
    this._records = new Map()
    this._entities = new Map()
  }

  // Constructors

  Entity (records) {
    return new Entity(this, records)
  }

  Record (spec) {
    if (spec[RECORD]) return spec[RECORD]
    const record = new Record(this, spec)
    if (this._opts.cache !== false) this._add(record)
    return record
  }

  FieldValueList (values) {
    return new FieldValueList(this, values)
  }

  // Schema methods
  setDefaultNamespace (namespace) {
    return this._schema.setDefaultNamespace(namespace)
  }

  defaultNamespace () {
    return this._schema.defaultNamespace()
  }

  resolveTypeAddress (address) {
    return this._schema.resolveTypeAddress(address)
  }

  resolveFieldAddress (address) {
    return this._schema.resolveFieldAddress(address)
  }

  addType (spec) {
    return this._schema.addType(spec)
  }

  getType (address) {
    return this._schema.getType(address)
  }

  hasType (address) {
    return this._schema.hasType(address)
  }

  getTypes (address) {
    return this._schema.getTypes(address)
  }

  hasField (address) {
    return this._schema.hasField(address)
  }

  getField (address) {
    return this._schema.getField(address)
  }

  serializeSchema () {
    return this._schema.toJSON()
  }

  addTypes (spec) {
    console.log('add types', spec)
    return this._schema.addTypes(spec)
  }

  // Record and entity methods

  getRecord (address) {
    return this._records.get(address)
  }

  getEntity (address) {
    return this._entities.get(address)
  }

  records () {
    return Array.from(this._records.values())
  }

  entities () {
    return Array.from(this._entities.values())
  }

  // TODO: Rename.
  _add (record) {
    this._records.set(record.address, record)

    let entity = this._entities.get(record.id)
    if (!entity) entity = this.Entity()
    entity.add(record)
    this._entities.set(entity.address, entity)
  }
}

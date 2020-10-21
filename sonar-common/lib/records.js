const { SC, RECORD } = require('./symbols')
const { bindSymbol } = require('./util')

// Base class for Record and Entity
class Node {
  constructor (schema) {
    bindSymbol(this, SC, schema)
  }

  field (name, single = true) {
    return this._field(name, single)
  }

  fields (name) {
    return this._field(name, false)
  }

  hasField (name) {
    try {
      return this.fields(name).length > 0
    } catch (err) {
      return false
    }
  }

  values (name) {
    return this.fields(name).values()
  }

  mapFields (name, fn) {
    if (!fn) {
      fn = name
      name = null
    }
    return this.fields(name).map(fn)
  }

  // TODO: Depcreate in favor of getOne/getMany.
  get (name, single = true) {
    return this.field(name, single).value
  }

  getOne (name) {
    return this.get(name, true)
  }

  getMany (name) {
    return this.get(name, false)
  }

  gotoOne (name) {
    return this._goto(name, true)
  }

  gotoMany (name) {
    return this._goto(name, false)
  }

  // Invoked by the Node high-level methods.
  _goto (name, single = false) {
    const field = this.field(name)
    // TODO: This means crash.
    if (!field) throw new Error('Field not found: ' + name)
    if (!field.type === 'relation') {
      throw new Error('Not a relation field: ' + name)
    }
    // TODO: Deal with multiple values
    const targetAddresses = field.values()
    const targetEntities = targetAddresses.map(address => {
      let entity = this[SC].getEntity(address)
      if (!entity) entity = new MissingEntity(this[SC], address)
      return entity
    })
    // TODO: targetEntities are Entity not FieldValue objects,
    // not sure if that is good or if it should be a Proxy or so
    // on FieldValue.
    const fieldValues = new FieldValueList(this[SC], ...targetEntities)
    if (single) return fieldValues.first()
    else return fieldValues.filter(f => !f.empty())
  }
}

class FieldValueList extends Array {
  constructor (schema, ...values) {
    super(...values)
    bindSymbol(this, SC, schema)
  }

  get value () {
    return this.values()
  }

  values () {
    return this.map(fv => fv.value)
  }

  first () {
    if (!this.length) return new MissingFieldValue(this._field)
    // TODO: How do we find the best value?
    return this[0]
  }
}

class Record extends Node {
  constructor (schema, record) {
    if (record instanceof Record) record = record._record

    if (!record.type) {
      throw new Error('Cannot upcast record: Missing type')
    }
    if (!record.id) {
      throw new Error('Cannot upcast record: Missing id')
    }

    // TODO: Decide how to deal with unknown types - likely we want to error here.
    // Maybe we also want to support deriving types on first use? Or allow to deal
    // with records with an unknown type in a limited fashion.
    if (!schema.getType(record.type)) {
      throw new Error(`Cannot upcast record: Unknown type "${record.type}"`)
    }
    record.type = schema.resolveTypeAddress(record.type)

    super(schema)

    this._record = record
    this._built = false

    // Prevent double-upcasting
    // TODO: Find out if this is a performance concern.
    this[RECORD] = this
    record[RECORD] = this
  }

  get entity () {
    return this[SC].getEntity(this.id)
  }

  get id () {
    return this._record.id
  }

  get value () {
    return this._record.value
  }

  get type () {
    return this._record.type
  }

  get address () {
    return this._record.key + '+' + this._record.seq
  }

  get deleted () {
    return this._record.deleted
  }

  // TODO: Remove?
  get key () {
    return this._record.key
  }

  get feed () {
    return this._record.key
  }

  get seq () {
    return this._record.seq
  }

  get lseq () {
    return this._record.lseq
  }

  get timestamp () {
    return this._record.timestamp
  }

  get meta () {
    return this._meta || this._record.meta || {}
  }

  set meta (obj) {
    if (!this._meta) this._meta = this.meta
    this._meta = { ...this.meta, ...obj }
  }

  // TODO: kappa-scopes/scopes.js:518 calls this to add lseq from indexer state.
  // Review how adding this info should work.
  set lseq (lseq) {
    this._record.lseq = lseq
  }

  get links () {
    return this._record.links
  }

  getType () {
    return this[SC].getType(this.type)
  }

  hasType (typeAddress) {
    typeAddress = this[SC].resolveTypeAddress(typeAddress)
    if (this.type === typeAddress) return true
    const type = this.getType()
    if (!type) return false
    const allTypes = type.allParents()
    return allTypes.indexOf(typeAddress) !== -1
  }

  // Invoked by the Node high-level methods.
  _field (fieldName, single = true) {
    const fieldValues = this._filterFieldValues(fieldName)
    if (single) return fieldValues.first()
    return fieldValues
  }

  _update (force = false) {
    if (!force && this._built) return
    this._buildFieldValues()
    this._built = true
  }

  _buildFieldValues () {
    const fields = this.getType().fields()
    this._fieldValues = new FieldValueList(this[SC])
    if (!this._record.value || typeof this._record.value !== 'object') {
      return
    }
    for (const field of fields) {
      if (this._record.value[field.name] !== undefined) {
        // const fieldValue = new FieldValue(field, this._record.value[field.name])
        const fieldValue = new FieldValue(field, this._record.value[field.name], this)
        this._fieldValues.push(fieldValue)
      }
    }
  }

  _findField (name) {
    if (name.indexOf('#') !== -1) {
      return this[SC].getField(name)
    }
    for (const field of this.getType().fields()) {
      if (field.name === name) return field
    }
    return null
  }

  _filterFieldValues (fieldName) {
    this._update()
    if (!fieldName) return this._fieldValues

    const field = this._findField(fieldName)
    if (!field) return new FieldValueList(this[SC])

    const validAddresses = field.allVariants()
    return this._fieldValues.filter(field => {
      return validAddresses.indexOf(field.fieldAddress) !== -1
    })
  }

  toJSON () {
    // TODO: Add opts to skip encoding lseq on put.
    // TODO: We don't need both address and key, seq.
    return {
      // stored keys
      id: this.id,
      type: this.type,
      value: this.value,
      links: this.links,
      deleted: this.deleted,
      timestamp: this.timestamp,

      // wire key
      key: this.key,
      seq: this.seq,
      lseq: this.lseq,
      meta: this.meta
    }
  }
}

class FieldValue {
  constructor (field, value, record) {
    this._field = field
    this._value = value
    this._record = record
  }

  get value () {
    // return this._record.value[this._field.name]
    return this._value
  }

  values () {
    const value = this.value
    return Array.isArray(value) ? value : [value]
  }

  get field () {
    return this._field
  }

  get fieldAddress () {
    return this._field.address
  }

  get fieldType () {
    return this._field.fieldType
  }

  get defaultWidget () {
    return this._field.defaultWidget
  }

  get name () {
    return this._field.name
  }

  get title () {
    return this._field.title || this._field.name
  }

  get record () {
    return this._record
  }

  empty () {
    return this._field.missing || this._value === undefined
  }

  first () {
    return this
  }
}

class MissingFieldValue extends FieldValue {
  constructor (field = {}) {
    field = Object.assign({
      title: '(missing field)',
      name: '_missing'
    }, field, { missing: true })
    super(field, undefined)
  }
}

class Entity extends Node {
  constructor (schema, records) {
    super(schema)
    this._records = new Set()
    this._id = null
    if (records) {
      for (const record of records) {
        this.add(record)
      }
    }
  }

  get id () {
    return this._id
  }

  get address () {
    return this._id
  }

  add (record) {
    record = this[SC].Record(record)
    if (!this._id) {
      this._id = record.id
    } else if (this._id !== record.id) {
      throw new Error('Cannot add record to entity: IDs do not match')
    }
    this._records.add(record)
  }

  empty () {
    return !this._missing && !this._records.size
  }

  hasType (typeAddress) {
    for (const record of this._records) {
      if (record.hasType(typeAddress)) return true
    }
    return false
  }

  getTypes () {
    return Array.from(new Set(
      Array.from(this._records).map(r => r.getType())
    ))
  }

  // Invoked by the Node high-level methods.
  _field (fieldName, single = true) {
    const fieldValues = new FieldValueList(this[SC])

    for (const record of this._records) {
      if (fieldName && record.hasField(fieldName)) {
        fieldValues.push(...record.field(fieldName, false))
      } else if (!fieldName) {
        fieldValues.push(...record.fields())
      }
    }

    if (single) return fieldValues.first()
    return fieldValues
  }
}

class MissingEntity extends Entity {
  constructor (schema, id) {
    super(schema)
    this._missing = true
    this._id = id
  }
}

module.exports = {
  Entity,
  MissingEntity,
  Record,
  FieldValue,
  FieldValueList,
  MissingFieldValue
}

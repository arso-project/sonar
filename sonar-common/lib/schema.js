const { MapSet } = require('./util')
const { parseAddress, encodeAddress } = require('./address')

const {
  RECORD,
  TYPE,
  FIELD
} = require('./symbols')

const {
  Entity,
  // MissingEntity,
  Record,
  // FieldValue,
  FieldValueList,
  // MissingFieldValue
} = require('./records')
const Store = require('./store')
const Type = require('./type')
const Field = require('./field')

module.exports = class Schema {
  constructor (opts = {}) {
    this._types = new Map()
    this._fields = new Map()
    this._typeVersions = new MapSet()
    this._defaultNamespace = opts.defaultNamespace

    // TODO: Move out of schema
    if (opts.recordCache !== false) {
      this._recordCache = new Store(this)
    }
  }

  Entity (records) {
    return new Entity(this, records)
  }

  Record (spec) {
    if (spec[RECORD]) return spec[RECORD]
    const record = new Record(this, spec)
    if (this._recordCache) this._recordCache.add(record)
    return record
  }

  Type (spec) {
    if (spec[TYPE]) return spec[TYPE]
    // Hacky check if it's a JSON schema or sonar spec.
    if (spec.properties) return Type.fromJSONSchema(this, spec)
    return new Type(this, spec)
  }

  Field (spec) {
    if (spec[FIELD]) return spec[FIELD]
    return new Field(this, spec)
  }

  FieldValueList (values) {
    return new FieldValueList(this, values)
  }

  setDefaultNamespace (namespace) {
    this._defaultNamespace = namespace
  }

  defaultNamespace () {
    if (!this._defaultNamespace) throw new Error('Default namespace is not set')
    return this._defaultNamespace
  }

  _parseAddress (address) {
    const parts = parseAddress(address)
    if (!parts.namespace) parts.namespace = this._defaultNamespace
    if (parts.version === undefined) {
      parts.version = this._typeVersions.highest(parts.namespace + '/' + parts.type)
    }
    return parts
  }

  resolveTypeAddress (address) {
    const parts = this._parseAddress(address)
    if (parts.field) throw new Error('Not a type address: ' + address)
    return encodeAddress(parts)
  }

  resolveFieldAddress (address) {
    const parts = this._parseAddress(address)
    if (!parts.field) throw new Error('Not a field address: ' + address)
    return encodeAddress(parts)
  }

  addType (spec) {
    if (this._types.has(spec.address)) {
      return this._types.get(spec.address)
    }
    const type = this.Type(spec)
    // TODO: Make sure types are immutable.
    this._types.set(type.address, type)
    this._typeVersions.add(type.namespace + '/' + type.name, type.version)
    return type
  }

  addTypeFromJsonSchema (spec) {
    spec = Type.jsonSchemaToSpec(spec)
    return this.addType(spec)
  }

  getType (address) {
    return this._types.get(address) || this._types.get(this.resolveTypeAddress(address))
  }

  hasType (address) {
    return this._types.has(address) || this._types.has(this.resolveTypeAddress(address))
  }

  getTypes () {
    return Array.from(this._types.values())
  }

  getRecord (address) {
    if (!this._recordCache) throw new Error('Cannot get records: Record cache disabled')
    return this._recordCache.getRecord(address)
  }

  getEntity (id) {
    if (!this._recordCache) throw new Error('Cannot get records: Record cache disabled')
    return this._recordCache.getEntity(id)
  }

  // This is called by the Type constructor.
  _addFieldForType (type, spec) {
    if (!(type instanceof Type)) throw new Error('Cannot add field: invalid type argument')
    if (!spec.name) throw new Error('Cannot add field: name is missing')

    const address = type.address + '#' + spec.name
    if (this.hasField(address)) {
      return this._fields.get(address)
      // throw new Error('Field exists: ' + address)
    }
    spec.address = address

    const field = this.Field(spec)
    this._fields.set(field.address, field)
    return field
  }

  hasField (address) {
    try {
      return this._fields.has(address) || this._fields.has(this.resolveFieldAddress(address))
    } catch (err) {
      return false
    }
  }

  getField (address) {
    return this._fields.get(address) || this._fields.get(this.resolveFieldAddress(address))
  }

  // fields (record) {
  //   record = this.Record(record)
  //   return record.fields()
  // }

  build (strict = true) {
    for (const field of this._fields.values()) {
      field._build(strict)
    }
  }

  toJSON () {
    const spec = {}
    for (const type of this._types.values()) {
      spec[type.address] = type.toJSONSchema()
    }
    return spec
  }

  fromJSON (spec) {
    for (const type of Object.values(spec)) {
      this.addType(type)
    }
  }

  // [inspect] (depth, opts) {
  //   const { stylize } = opts
  //   var indent = ''
  //   if (typeof opts.indentationLvl === 'number') {
  //     while (indent.length < opts.indentationLvl) indent += ' '
  //   }

  //   const types = this.getTypes().map(type => {
  //     const fields = type.fields().map(field => `${field.name} (${field.fieldType})`)
  //       .join(', ')
  //     return indent + `${type.address}:\n` + indent + '    ' + fields.substring(0, fields.length - 2)
  //   }).join('\n')

  //   return 'Schema(\n' +
  //         indent + '  defaultNamespace: ' + stylize(this._defaultNamespace, 'string') + '\n' +
  //         types + ')'
  // }
}
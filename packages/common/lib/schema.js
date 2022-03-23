const { MapSet } = require('./util')
const { parseAddress, encodeAddress } = require('./address')

// const Store = require('./store')
const Type = require('./type')
const Field = require('./field')
const { Record, RecordVersion, Entity } = require('./records')

module.exports = class Schema {
  constructor (opts = {}) {
    this._types = new Map()
    this._fields = new Map()
    this._typeVersions = new MapSet()
    this._defaultNamespace = opts.defaultNamespace
    this._onchange = opts.onchange || noop
  }

  Record (record) {
    return new Record(this, record)
  }

  RecordVersion (recordVersion) {
    return new RecordVersion(this, recordVersion)
  }

  Entity (records) {
    return new Entity(this, records)
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
      parts.version = this._typeVersions.highest(
        parts.namespace + '/' + parts.type
      )
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

  addType (spec, opts = {}) {
    if (spec.address && this._types.has(spec.address)) {
      return this._types.get(spec.address)
    }
    // TODO: Remove
    if (Type.isJsonSchema(spec)) {
      spec = Type.jsonSchemaToSpec(spec)
    }

    const type = new Type(this, spec)

    // TODO: Make sure types are immutable.
    this._types.set(type.address, type)
    this._typeVersions.add(type.namespace + '/' + type.name, type.version)
    if (opts.onchange !== false) this._onchange(this)
    return type
  }

  // TODO: Remove
  // _addTypeFromJsonSchema (spec) {
  //   spec = Type.jsonSchemaToSpec(spec)
  //   return this.addType(spec)
  // }

  getType (address) {
    return (
      this._types.get(address) ||
      this._types.get(this.resolveTypeAddress(address))
    )
  }

  hasType (address) {
    return (
      this._types.has(address) ||
      this._types.has(this.resolveTypeAddress(address))
    )
  }

  getTypes () {
    return Array.from(this._types.values())
  }

  // This is called by the Type constructor.
  _addFieldForType (type, spec) {
    if (!(type instanceof Type))
      throw new Error('Cannot add field: invalid type argument')
    if (!spec.name) throw new Error('Cannot add field: name is missing')

    const address = type.address + '#' + spec.name
    if (this.hasField(address)) {
      return this._fields.get(address)
      // throw new Error('Field exists: ' + address)
    }
    spec.address = address

    const field = new Field(this, spec)
    this._fields.set(field.address, field)
    return field
  }

  hasField (address) {
    try {
      return (
        this._fields.has(address) ||
        this._fields.has(this.resolveFieldAddress(address))
      )
    } catch (err) {
      return false
    }
  }

  getField (address) {
    return (
      this._fields.get(address) ||
      this._fields.get(this.resolveFieldAddress(address))
    )
  }

  build (strict = true) {
    for (const field of this._fields.values()) {
      field._build(strict)
    }
  }

  toJSON () {
    const spec = {}
    for (const type of this._types.values()) {
      spec[type.address] = type.toJSON()
    }
    return spec
  }

  addTypes (spec) {
    const types = Array.isArray(spec) ? spec : Object.values(spec)
    for (const type of types) {
      this.addType(type, { onchange: false })
    }
    this._onchange(this)
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

function noop () {}

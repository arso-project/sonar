const objectPath = require('object-path')
const inspect = require('inspect-custom-symbol')

const RECORD = Symbol('sonar-record')
const TYPE = Symbol('sonar-type')
const FIELD = Symbol('sonar-field')
const SC = Symbol('sonar-schema')

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

function jsonSchemaToSpec (spec) {
  if (!spec.fields) spec.fields = {}
  if (spec.properties) {
    for (let [name, fieldSpec] of Object.entries(spec.properties)) {
      if (fieldSpec.sonar) {
        fieldSpec = Object.assign(fieldSpec, fieldSpec.sonar)
        fieldSpec.sonar = undefined
      }
      spec.fields[name] = fieldSpec
    }
    spec.properties = undefined
  }
  if (spec.$id) {
    spec.address = spec.$id
    spec.$id = undefined
  }
  if (spec.sonar) {
    spec = Object.assign(spec, spec.sonar)
    spec.sonar = undefined
  }
  return spec
}

class Type {
  static jsonSchemaToSpec (spec) {
    return jsonSchemaToSpec(spec)
  }

  static fromJSONSchema (schema, spec) {
    return new Type(schema, jsonSchemaToSpec(spec))
  }

  constructor (schema, spec) {
    bindSymbol(this, SC, schema)
    this._fields = new Set()

    if (spec.address) {
      const parts = parseAddress(spec.address)
      this._namespace = parts.namespace
      this._name = parts.type
      this._version = parts.version || 0
    } else {
      // This will throw if namespace is undefined and default namespace is not set.
      this._namespace = spec.namespace || this[SC].defaultNamespace()
      this._name = spec.name
      this._version = spec.version || 0
    }

    if (!this._name) throw new Error('Cannot create Type: missing name')

    this._address = encodeAddress({
      namespace: this._namespace,
      type: this._name,
      version: this._version
    })

    if (spec.fields) {
      for (const [name, fieldSpec] of Object.entries(spec.fields)) {
        fieldSpec.name = name
        const field = this[SC]._addFieldForType(this, fieldSpec)
        this._fields.add(field.address)
      }
    }

    if (spec.refines) {
      this._parent = this[SC].resolveTypeAddress(spec.refines)
    }

    this._info = {
      title: spec.title,
      description: spec.description
    }
  }

  get title () {
    return this._info.title || this._name
  }

  get name () {
    return this._name
  }

  get namespace () {
    return this._namespace
  }

  get description () {
    return this._info.description
  }

  get address () {
    return this._address
  }

  get version () {
    return this._version
  }

  parentType () {
    if (!this._parent) return null
    return this[SC].getType(this._parent)
  }

  allParents () {
    const addresses = [this.address]
    const parentType = this.parentType()
    if (parentType) addresses.push(...parentType.allParents())
    return addresses
  }

  // TODO: Do the resolution only once, not on each call?
  // TODO: Or: Use an lazy iterator.
  fields () {
    const fields = Array.from(this._fields)
      .map(address => this[SC].getField(address))

    const parentType = this.parentType()
    if (parentType) {
      fields.push(...parentType.fields())
    }

    return fields
  }

  fieldAddresses () {
    return this.fields.map(field => field.address)
  }

  toJSONSchema () {
    const spec = {
      $id: this.address,
      properties: {}
    }
    if (this.title) spec.title = this.title
    if (this.description) spec.description = this.description
    for (const field of this.fields()) {
      spec.properties[field.name] = field.toJSONSchema()
    }
    return spec
  }

  toJSON () {
    return {
      address: this.address,
      title: this.title,
      description: this.description,
      refines: this._parent,
      fields: this.fields().reduce((all, field) => {
        all[field.name] = field.toJSON()
        return all
      }, {})
    }
  }
}

class MissingType extends Type {
  constructor (schema) {
    super(schema, { name: '_missing', missing: true })
  }
}

class Field {
  constructor (schema, spec) {
    if (!spec.address) throw new Error('Field address is required')
    if (!spec.name) throw new Error('Field name is required')
    bindSymbol(this, SC, schema)
    this._address = spec.address
    this._spec = spec
    this._children = new Set()
    this._parent = null
  }

  get name () {
    return this._spec.name
  }

  get fieldType () {
    return this._spec.type
  }

  get title () {
    return this._spec.title
  }

  get description () {
    return this._spec.description
  }

  get address () {
    return this._address
  }

  get index () {
    return this._spec.index || {}
  }

  allVariants () {
    const addresses = [this.address]
    addresses.push(...this._children)
    if (this._parent) addresses.push(this[SC].getField(this._parent).allVariants())
    return addresses
  }

  getParent () {
    if (!this._parent) return null
    return this[SC].getField(this._parent)
  }

  _build (strict = true, force = false) {
    if (!force && this._built) return
    this._mergeRefines(strict)
    this._built = true
  }

  _mergeRefines (strict = true) {
    // Nothing to do for fields without parents.
    if (!this._spec.refines) return

    // TODO: This will endlessly loop for nested refineds.
    // It should throw or stop when recursion is encountered.
    const parent = this[SC].getField(this._spec.refines)

    if (strict && !parent) {
      throw new Error(`Missing parent field ${this._spec.refines} while resolving ${this.address}`)
    } else if (!parent) return

    parent._build()
    this._parent = parent.address
    parent._children.add(this.address)

    for (const [key, value] of Object.entries(parent)) {
      if (this._spec[key] === undefined) {
        this._spec[key] = value
      }
    }
  }

  getType () {
    const typeAddress = this._address.split('#')[0]
    return this[SC].getType(typeAddress)
  }

  setProp (path, value) {
    objectPath.set(this._spec, path, value)
  }

  getProp (path) {
    objectPath.get(this._spec)
  }

  toJSONSchema () {
    const spec = {}
    spec.title = this.title
    spec.description = this.description

    // TODO: Define list of properties allowed.
    const sonarInfo = {
      refines: this._parent,
      index: this._spec.index
    }

    // TODO: Likely we want to have this handled by field type classes,
    // so this.fieldType.jsonType()
    if (this.fieldType === 'relation') {
      spec.type = 'string'
      sonarInfo.fieldType = this.fieldType
    } else {
      spec.type = this.fieldType
    }
    spec.sonar = sonarInfo
    return spec
  }

  toJSON () {
    return this._spec
  }

  // static fromJSONSchema (schema, json) {
  //   const spec = {
  //     ...json,
  //     fields: {},
  //     ...json.sonar || {}
  //   }
  //   for (const [name, fieldSpec] of Object.entries(spec)) {
  //     spec.fields[name] = {
  //       ...fieldSpec,
  //       ...fieldSpec.sonar || {}
  //     }
  //     if (!fieldSpec.fieldType && fieldSpec.type) {
  //       fieldSpec.fieldType = fieldSpec.type
  //     }
  //   }
  //   spec.properties = undefined
  //   return new Field(schema, spec)
  // }
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

class RecordCache {
  constructor (schema) {
    bindSymbol(this, SC, schema)
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
    if (!entity) entity = this[SC].Entity()
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

module.exports = class Schema {
  constructor (opts = {}) {
    this._types = new Map()
    this._fields = new Map()
    this._typeVersions = new MapSet()
    this._defaultNamespace = opts.defaultNamespace
    if (opts.recordCache !== false) {
      this._recordCache = new RecordCache(this)
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

class MapSet {
  constructor () {
    this._map = new Map()
  }

  get (key) {
    if (this._map.has(key)) return this._map.get(key)
    return new Set()
  }

  add (key, value) {
    if (!this._map.has(key)) this._map.set(key, new Set())
    this.get(key).add(value)
  }

  has (key, value) {
    if (!this._map.has(key)) return false
    return this._map.get(key).has(value)
  }

  highest (key) {
    if (!this._map.has(key)) return null
    return Array.from(this._map.get(key)).sort().pop()
  }
}

function parseAddress (address) {
  if (!address) throw new Error('Cannot parse empty address')

  // Allow an object with address property
  if (typeof address === 'object' && typeof address.address === 'string') {
    address = address.address
  // Allow an object with { namespace, type, field, version } properties
  } else if (typeof address === 'object') {
    return parseAddress(encodeAddress(address))
  }

  // Parse the address format. Example:
  // sonar/Entity@3#label
  const regex = /^(?:([^/#@]+)\/)?([^@#/]+)(?:@(\d+))?(?:#([^/#@]+))?$/
  const matches = address.match(regex)
  if (!matches) throw new Error('Invalid address')
  matches.shift()
  let [namespace, type, version, field] = matches
  if (version) version = parseInt(version)
  return { namespace, type, field, version }
}

function encodeAddress (parts) {
  let { namespace, type, field, version } = parts
  if (!type || !validSegment(type)) {
    throw new Error('Cannot encode address: invalid type name')
  }
  if (namespace && !validSegment(namespace)) {
    throw new Error('Cannot encode address: invalid namespace')
  }
  if (field && !validSegment(field)) {
    throw new Error('Cannot encode address: invalid field name')
  }
  if (!version) version = 0
  let address = ''
  if (namespace) address += namespace + '/'
  if (type) address += type
  if (version !== undefined) address += '@' + version
  if (field) address += '#' + field
  return address
}

function validSegment (segment) {
  return !hasChar(segment, '/') && !hasChar(segment, '#') && !hasChar(segment, '@')
}

function hasChar (str, char) {
  return str.indexOf(char) !== -1
}

function bindSymbol (obj, symbol, value) {
  Object.defineProperty(obj, symbol, {
    enumerable: false,
    configurable: false,
    writable: false,
    value
  })
}

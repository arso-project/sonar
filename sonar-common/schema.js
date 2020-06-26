const RECORD = Symbol('sonar-record')
const TYPE = Symbol('sonar-type')
const FIELD = Symbol('sonar-field')

class FieldValueList extends Array {
  setField (field) {
    this._field = field
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

class Record {
  constructor (schema, record) {
    if (record instanceof Record) record = record._record

    this._record = record
    this._schema = schema
    this._type = this._schema.getType(this._record.type)
    this._dirty = true

    if (!this._type) {
      throw new Error(`Cannot upgrade record: Unknown type "${this._record.type}"`)
    }

    // Prevent double-upcasting
    // TODO: Find out if this is a performance concern.
    this[RECORD] = this
  }

  get id () {
    return this._record.id
  }

  get value () {
    return this._record.value
  }

  get type () {
    return this._type.address
  }

  get address () {
    return this._record.key + '+' + this._record.seq
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

  get links () {
    return this._record.links
  }

  getType () {
    return this._type
  }

  is (typeAddress) {
    typeAddress = this._schema.resolveTypeAddress(typeAddress)
    const allTypes = this.getType().allParents()
    return allTypes.indexOf(typeAddress) !== -1
  }

  fields (fieldName) {
    return this._filterFieldValues(fieldName)
  }

  field (fieldName, single = true) {
    if (!single) return this.fields(fieldName)
    else return this.fields(fieldName).first()
  }

  hasField (name) {
    return this.fields(name).length > 0
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

  _goto (name, single = false) {
    const field = this.field(name)
    // TODO: This means crash.
    if (!field) throw new Error('Field not found: ' + name)
    if (!field.type === 'relation') {
      throw new Error('Not a relation field: ' + name)
    }
    // TODO: Deal with multiple values
    // console.log(field)
    const targetAddresses = field.values()
    const targetEntities = targetAddresses.map(address => {
      return this._schema.getEntity(address)
    })
    const fieldValues = new FieldValueList(...targetEntities)
    if (single) return fieldValues.first()
    return fieldValues
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

  _update (force = false) {
    if (!force && !this._dirty) return
    this._buildFieldValues()
    this._dirty = false
  }

  _buildFieldValues () {
    const fields = this._type.fields()
    this._fieldValues = new FieldValueList()
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
      return this._schema.getField(name)
    }
    const fields = this.getType().fields()
    const filtered = fields.filter(f => f.name === name)
    if (filtered.length !== 1) throw new Error('Field not found: ' + name)
    return filtered[0]
  }

  _filterFieldValues (fieldName) {
    this._update()
    if (!fieldName) return this._fieldValues

    const field = this._findField(fieldName)
    if (!field) return new FieldValueList()

    const validAddresses = field.allVariants()
    return this._fieldValues.filter(field => {
      return validAddresses.indexOf(field.address) !== -1
    })
  }

  toJSON () {
    return {
      address: this.address,
      id: this.id,
      lseq: this.lseq,
      type: this.type,
      value: this.value,
      links: this.links
    }
  }

  async update (fn) {
    throw new Error('Not connected to a collection')
  }

  async save () {
    throw new Error('Not connected to a collection')
  }

  async getFeed () {
    throw new Error('Not connected to a collection')
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

  get address () {
    return this._field.address
  }

  get fieldType () {
    return this._field.type
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

class Type {
  static fromJSONSchema (schema, spec) {
    if (!spec.fields) spec.fields = {}
    if (spec.properties) {
      for (let [name, fieldSpec] of Object.entries(spec.properties)) {
        if (fieldSpec._sonar) {
          fieldSpec = Object.assign(fieldSpec, fieldSpec._sonar)
          fieldSpec._sonar = undefined
        }
        spec.fields[name] = fieldSpec
      }
      spec.properties = undefined
    }
    if (spec.$id) {
      spec.address = spec.$id
      spec.$id = undefined
    }
    if (spec._sonar) {
      spec = Object.assign(spec, spec._sonar)
      spec._sonar = undefined
    }
    return new Type(schema, spec)
  }

  constructor (schema, spec) {
    this._schema = schema
    this._fields = new Set()

    if (spec.address) {
      const parts = parseAddress(spec.address)
      this._namespace = parts.namespace
      this._name = parts.type
      this._version = parts.version || 0
    } else {
      // This will throw if namespace is undefined and default namespace is not set.
      this._namespace = spec.namespace || this._schema.defaultNamespace()
      this._name = spec.name
      this._version = spec.version || 0
    }

    if (!this._name) throw new Error('Cannot create Type: missing name')

    this._address = encodeAddress({
      namespace: this._namespace,
      type: this._name,
      version: this._version
    })

    for (const [name, fieldSpec] of Object.entries(spec.fields)) {
      fieldSpec.name = name
      const field = this._schema._addFieldForType(this, fieldSpec)
      this._fields.add(field.address)
    }

    if (spec.refines) {
      this._parent = this._schema.resolveTypeAddress(spec.refines)
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
    return this._schema.getType(this._parent)
  }

  allParents () {
    const addresses = [this.address]
    if (this._parent) addresses.push(...this.parentType().allParents())
    return addresses
  }

  // TODO: Do the resolution only once, not on each call?
  // TODO: Or: Use an lazy iterator.
  fields () {
    const fields = Array.from(this._fields)
      .map(address => this._schema.getField(address))

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
}

class Field {
  constructor (schema, spec) {
    if (!spec.address) throw new Error('Field address is required')
    if (!spec.name) throw new Error('Field name is required')
    this._schema = schema
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

  allVariants () {
    const addresses = [this.address]
    addresses.push(...this._children)
    if (this._parent) addresses.push(this._schema.getField(this._parent).allVariants())
    return addresses
  }

  getParent () {
    if (!this._parent) return null
    return this._schema.getField(this._parent)
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
    const parent = this._schema.getField(this._spec.refines)

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
    return this._schema.getType(typeAddress)
  }

  toJSONSchema () {
    const spec = {}
    spec.title = this.title
    spec.description = this.description
    const details = {}
    if (this.type === 'relation') {
      spec.type = 'string'
      details.type = 'relation'
    } else {
      spec.type = 'string'
    }
    if (this._parent) {
      details.refines = this._parent
    }
    if (Object.keys(details).length) {
      spec._sonar = details
    }
    return spec
  }
}

class Entity {
  constructor (schema, records) {
    this._schema = schema
    this._records = new Set()
    this._types = new Set()
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

  is (typeAddress) {
    for (const record of this._records) {
      if (record.is(typeAddress)) return true
    }
    return false
  }

  add (record) {
    record = this._schema.Record(record)
    if (!this._id) {
      this._id = record.id
    } else if (this._id !== record.id) {
      throw new Error('Cannot add record to entity: IDs do not match')
    }
    this._records.add(record)
    this._types.add(record.getType())
  }

  types () {
    return Array.from(this._types)
  }

  field (fieldName, single = true) {
    const fieldValues = new FieldValueList()

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

  fields (fieldName) {
    return this.field(fieldName, false)
  }

  get (fieldName, single = true) {
    return this.field(fieldName, single).value
  }

  values (fieldName) {
    return this.fields(fieldName).value
  }

  mapFields (fieldName, fn) {
    if (!fn) {
      fn = fieldName
      fieldName = null
    }
    return this.fields(fieldName).map(fn)
  }
}

class RecordCache {
  constructor (schema) {
    this._schema = schema
    this._records = new Map()
    this._entities = new Map()
  }

  add (record) {
    this._records.set(record.address, record)
    if (!this._entities.has(record.id)) {
      this._entities.set(record.id, this._schema.Entity())
    }
    this._entities.get(record.id).add(record)
  }

  getRecord (address) {
    return this._records.get(address)
  }

  getEntity (id) {
    return this._entities.get(id)
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

  Record (record) {
    if (record[RECORD]) return record[RECORD]
    record[RECORD] = new Record(this, record)
    if (this._recordCache) this._recordCache.add(record[RECORD])
    return record[RECORD]
  }

  Type (spec) {
    if (spec[TYPE]) return spec[TYPE]
    // return new Type(this, spec)
    return Type.fromJSONSchema(this, spec)
  }

  Field (spec) {
    if (spec[FIELD]) return spec[FIELD]
    return new Field(this, spec)
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
    const type = this.Type(spec)
    // TODO: Allow if version is increased.
    if (this._types.has(type.address)) throw new Error('Type exists: ' + type.address)
    this._types.set(type.address, type)
    this._typeVersions.add(type.namespace + '/' + type.name, type.version)
    return type
  }

  getType (address) {
    return this._types.get(address) || this._types.get(this.resolveTypeAddress(address))
  }

  hasType (address) {
    return this._types.has(address) || this._types.has(this.resolveTypeAddress(address))
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
    if (this.hasField(address)) throw new Error('Field exists: ' + address)
    spec.address = address

    const field = this.Field(spec)
    this._fields.set(field.address, field)
    return field
  }

  hasField (address) {
    return this._fields.has(address) || this._fields.has(this.resolveFieldAddress(address))
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
  if (typeof address === 'object') return parseAddress(encodeAddress(address))
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
  if (!type) throw new Error('Cannot encode address: type is missing')
  if (!version) version = 0
  let address = ''
  if (namespace) address += namespace + '/'
  if (type) address += type
  if (version !== undefined) address += '@' + version
  if (field) address += '#' + field
  return address
}

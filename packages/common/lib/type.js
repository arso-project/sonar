const { bindSymbol } = require('./util')
const { parseAddress, encodeAddress } = require('./address')
const { SC } = require('./symbols')

class Type {
  static jsonSchemaToSpec (spec) {
    return jsonSchemaToSpec(spec)
  }

  static isJsonSchema (spec) {
    return isJsonSchema(spec)
  }

  // static fromJSONSchema (schema, spec) {
  //   return new Type(schema, jsonSchemaToSpec(spec))
  // }

  constructor (schema, spec) {
    bindSymbol(this, SC, schema)
    this._fields = new Set()

    if (spec.address) {
      const parts = parseAddress(spec.address)
      this._namespace = parts.namespace
      this._name = parts.type
      this._version = parts.version || spec.version || 0
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
      // TODO: Think through if we want the version in the address.
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
    const fields = Array.from(this._fields).map(address =>
      this[SC].getField(address)
    )

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

Type.MissingType = MissingType

module.exports = Type
module.exports.jsonSchemaToSpec = jsonSchemaToSpec

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

function isJsonSchema (spec) {
  if (spec.properties) return true
  return false
}

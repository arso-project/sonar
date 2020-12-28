const objectPath = require('object-path')

const { bindSymbol } = require('./util')
const { SC } = require('./symbols')

class Field {
  constructor (schema, spec) {
    if (!spec.address) throw new Error('Field address is required')
    if (!spec.name) throw new Error('Field name is required')
    if (!spec.defaultWidget) {
      spec.defaultWidget = 'TextWidget'
    }
    bindSymbol(this, SC, schema)
    this._address = spec.address
    this._defaultWidget = spec.defaultWidget
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
    return this._spec.title || this._spec.name
  }

  get description () {
    return this._spec.description
  }

  get address () {
    return this._address
  }

  get defaultWidget () {
    return this._defaultWidget
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

    // for (const [key, value] of Object.entries(parent)) {
    //   if (this._spec[key] === undefined) {
    //     this._spec[key] = value
    //   }
    // }
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

module.exports = Field

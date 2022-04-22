import objectPath from 'object-path'
import { SC } from './symbols.js'
import type { Schema } from './schema.js'
import { TypeSpec } from './schema.js'
import { SchemaMember } from './base.js'
import { JSONSchema4, JSONSchema4TypeName, JSONSchema4Type } from 'json-schema'

export interface FieldSpecInput {
  name?: string
  type: JSONSchema4TypeName | 'relation'
  multiple?: boolean
  refines?: string
  fieldType?: string
  index?: IndexOpts
  targetTypes?: string[]
  properties?: Record<string, JSONSchema4>
  enum?: JSONSchema4Type[] | undefined
  required?: boolean
  address?: string
  defaultWidget?: string

  title?: string
  description?: string
}

export type FieldSpec = FieldSpecInput & { name: string }
// = JSONSchema4 | {
//   name?: string
//   type: JSONSchema4TypeName | "relation"
// } & JSONSchema4 & SonarFieldInfo

export interface SonarFieldInfo {
  multiple?: boolean
  refines?: string
  fieldType?: string
  index?: IndexOpts
}

export interface IndexOpts {
  basic?: boolean
  search?: {
    mode?: SearchIndexMode
  }
}

export type SearchIndexMode = 'facet' | 'fulltext'

export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'relation'

export class Field extends SchemaMember {
  _address: string
  _defaultWidget: string
  _spec: FieldSpec
  _children: Set<string> = new Set()
  _parent: string | null = null
  _built = false
  missing = false
  constructor (schema: Schema, spec: FieldSpec) {
    super(schema)
    if (!spec.address) { throw new Error('Field address is required') }
    if (!spec.name) { throw new Error('Field name is required') }
    if (!spec.defaultWidget) {
      spec.defaultWidget = 'TextWidget'
    }
    this._address = spec.address
    this._defaultWidget = spec.defaultWidget
    this._spec = spec
  }

  get name (): string {
    return this._spec.name
  }

  get fieldType (): string {
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
    return (this._spec.index != null) || {}
  }

  get multiple () {
    return this._spec.multiple
  }

  allVariants () {
    const addresses = [this.address]
    addresses.push(...this._children)
    if (this._parent) {
      const parentField = this[SC].getField(this._parent)
      if (parentField != null) {
        addresses.push(...parentField.allVariants())
      }
    }
    return addresses
  }

  getParent () {
    if (!this._parent) { return null }
    return this[SC].getField(this._parent)
  }

  _build (strict = true, force = false) {
    if (!force && this._built) { return }
    this._mergeRefines(strict)
    this._built = true
  }

  _mergeRefines (strict = true) {
    // Nothing to do for fields without parents.
    if (!this._spec.refines) { return }
    // TODO: This will endlessly loop for nested refineds.
    // It should throw or stop when recursion is encountered.
    const parent = this[SC].getField(this._spec.refines)
    if (strict && (parent == null)) {
      throw new Error(`Missing parent field ${this._spec.refines} while resolving ${this.address}`)
    } else if (parent == null) { return }
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

  setProp (path: string, value: any) {
    objectPath.set(this._spec, path, value)
  }

  getProp (path: string): any {
    return objectPath.get(this._spec, path)
  }

  toJSONSchema () {
    const spec: JSONSchema4 = {}
    spec.title = this.title
    spec.description = this.description
    // TODO: Define list of properties allowed.
    const sonarInfo: SonarFieldInfo = {
      refines: this._parent || undefined,
      index: this._spec.index,
      fieldType: undefined
    }
    // TODO: Likely we want to have this handled by field type classes,
    // so this.fieldType.jsonType()
    if (this.fieldType === 'relation') {
      spec.type = 'string'
      sonarInfo.fieldType = this.fieldType
    } else {
      spec.type = this.fieldType as JSONSchema4TypeName
    }
    spec.sonar = sonarInfo
    return spec
  }

  toJSON () {
    return this._spec
  }
}

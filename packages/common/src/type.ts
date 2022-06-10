import { parseSchemaPath, encodeSchemaPath } from './address.js'
import { SC } from './symbols.js'

import type { JSONSchema4 } from 'json-schema'

import type { Schema, TypeSpec, TypeSpecInput } from './schema.js'
import { SchemaMember } from './base.js'
import type { Field, FieldSpec } from './field'

export class Type extends SchemaMember {
  static MissingType: typeof MissingType
  static jsonSchemaToSpec (spec: JSONSchema4) {
    return jsonSchemaToSpec(spec)
  }

  static isJsonSchema (spec: any) {
    return isJsonSchema(spec)
  }

  private _fields: Set<string> = new Set()
  private _namespace: string
  private _name: string
  private _version: number
  private _address: string
  private _parent: string | null = null
  private _info: { title?: string, description?: string }

  // static fromJSONSchema (schema, spec) {
  //   return new Type(schema, jsonSchemaToSpec(spec))
  // }
  constructor (schema: Schema, spec: TypeSpecInput) {
    super(schema)
    if (spec.address) {
      const parts = parseSchemaPath(spec.address)
      this._namespace = parts.namespace
      this._name = parts.type
      this._version = parts.version || spec.version || 0
    } else {
      // This will throw if namespace is undefined and default namespace is not set.
      this._namespace = spec.namespace || this[SC].defaultNamespace()
      this._name = spec.name!
      this._version = spec.version || 0
    }
    if (!this._name) { throw new Error('Cannot create Type: missing name') }
    this._address = encodeSchemaPath({
      namespace: this._namespace,
      type: this._name,
      // TODO: Think through if we want the version in the address.
      version: this._version
    })
    if (spec.fields) {
      for (const [name, fieldSpecInput] of Object.entries(spec.fields)) {
        const fieldSpec: FieldSpec = { ...fieldSpecInput, name }
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

  get name (): string {
    return this._name
  }

  get namespace (): string {
    return this._namespace
  }

  get description (): string | undefined {
    return this._info.description
  }

  get address (): string {
    return this._address
  }

  get version (): number {
    return this._version
  }

  parentType (): null | Type {
    if (!this._parent) { return null }
    return this[SC].getType(this._parent) || null
  }

  allParents () {
    const addresses = [this.address]
    const parentType = this.parentType()
    if (parentType) { addresses.push(...parentType.allParents()) }
    return addresses
  }

  // TODO: Do the resolution only once, not on each call?
  // TODO: Or: Use an lazy iterator.
  fields (): Field[] {
    const fields = Array.from(this._fields).map(address => this[SC].getField(address)).filter(x => x) as Field[]
    const parentType = this.parentType()
    if (parentType) {
      fields.push(...parentType.fields())
    }
    return fields
  }

  hasField (fieldName: string): boolean {
    const address = this[SC].resolveFieldAddress(fieldName, this)
    return this.fieldAddresses().includes(address)
  }

  getField (fieldName: string): Field | undefined {
    const address = this[SC].resolveFieldAddress(fieldName, this)
    return this.fields().find(field => field.address === address)
  }

  fieldAddresses () {
    return this.fields().map(field => field.address)
  }

  toJSONSchema (): JSONSchema4 {
    const spec: JSONSchema4 = {
      $id: this.address,
      properties: {}
    }
    if (this.title) { spec.title = this.title }
    if (this.description) { spec.description = this.description }
    for (const field of this.fields()) {
      spec.properties![field.name] = field.toJSONSchema()
    }
    return spec
  }

  toJSON (): TypeSpec {
    return {
      name: this.name,
      namespace: this.namespace,
      version: this.version,
      address: this.address,
      title: this.title,
      description: this.description,
      refines: this._parent || undefined,
      fields: this.fields().reduce<Record<string, FieldSpec>>((all, field) => {
        all[field.name] = field.toJSON()
        return all
      }, {})
    }
  }
}
export class MissingType extends Type {
  constructor (schema: Schema) {
    super(schema, { name: '_missing', namespace: '_missing', version: 1, missing: true, fields: {} })
  }
}

Type.MissingType = MissingType

function jsonSchemaToSpec (spec: JSONSchema4): TypeSpec {
  if (!spec.fields) { spec.fields = {} }
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
  return spec as TypeSpec
}
function isJsonSchema (spec: TypeSpec & JSONSchema4): boolean {
  if (spec.properties) { return true }
  return false
}
export default Type
export { jsonSchemaToSpec }

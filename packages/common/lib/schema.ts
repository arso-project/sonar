import { MapSet } from './util.js'
import { parseSchemaPath, encodeSchemaPath } from './address.js'
import { Type } from './type.js'
import { Field, FieldSpec, FieldSpecInput } from './field.js'
import { Record, RecordVersion, Entity } from './index.js'
// import {JSONSchema4} from 'json-schema'

export type SchemaOnChangeCallback = (schema: Schema) => void

export interface TypeSpecInput {
  name?: string
  namespace?: string
  version?: number
  missing?: boolean
  fields: globalThis.Record<string, FieldSpecInput>,

  address?: string
  refines?: string

  title?: string
  description?: string
}

export type TypeSpec = TypeSpecInput & {
  name: string
  namespace: string
  version: number
  address: string
}

export type SchemaSpec = globalThis.Record<string, TypeSpec>

export interface SchemaOpts {
  defaultNamespace?: string
  onchange?: SchemaOnChangeCallback
}

export interface AddTypeOpts {
  onchange?: boolean
}

export class Schema {
  _types = new Map<string, Type>()
  _fields = new Map<string, Field>()
  _typeVersions = new MapSet<number>()

  _defaultNamespace: string | undefined
  _onchange: (schema: Schema) => void

  constructor (opts: SchemaOpts = {}) {
    this._defaultNamespace = opts.defaultNamespace
    this._onchange = opts.onchange || noop
  }

  // TODO: Remove any
  Record (record: Record | any) {
    return new Record(this, record)
  }

  // TODO: Remove any
  RecordVersion (recordVersion: RecordVersion | any) {
    return new RecordVersion(this, recordVersion)
  }

  Entity (records: Record[]) {
    return new Entity(this, records)
  }

  setDefaultNamespace (namespace: string) {
    this._defaultNamespace = namespace
  }

  defaultNamespace (): string {
    if (!this._defaultNamespace) { throw new Error('Default namespace is not set') }
    return this._defaultNamespace
  }

  _parseSchemaPath (address: string) {
    const parts = parseSchemaPath(address)
    if (!parts.namespace) { parts.namespace = this._defaultNamespace as string }
    if (parts.version === undefined) {
      parts.version = this._typeVersions.highest(parts.namespace + '/' + parts.type)
    }
    return parts
  }

  resolveTypeAddress (address: string) {
    const parts = this._parseSchemaPath(address)
    if (parts.field) { throw new Error('Not a type address: ' + address) }
    return encodeSchemaPath(parts)
  }

  resolveFieldAddress (address: string, type?: Type) {
    if (type && !address.includes('#')) {
      address = encodeSchemaPath({ namespace: type.namespace, type: type.name, field: address, version: type.version })
    }
    const parts = this._parseSchemaPath(address)
    if (!parts.field) { throw new Error('Not a field address: ' + address) }
    return encodeSchemaPath(parts)
  }

  addType (spec: TypeSpecInput, opts: AddTypeOpts = {}): Type {
    if (spec.address && this._types.has(spec.address)) {
      return this._types.get(spec.address)!
    }
    // TODO: Remove
    if (Type.isJsonSchema(spec)) {
      spec = Type.jsonSchemaToSpec(spec)
    }
    const type = new Type(this, spec)
    // TODO: Make sure types are immutable.
    this._types.set(type.address, type)
    this._typeVersions.add(type.namespace + '/' + type.name, type.version)
    if (opts.onchange !== false) { this._onchange(this) }
    return type
  }

  getType (address: string): Type | undefined {
    return this._types.get(address) || this._types.get(this.resolveTypeAddress(address))
  }

  hasType (address: string): boolean {
    return !!(this._types.has(address) ||
            this._types.has(this.resolveTypeAddress(address)))
  }

  getTypes (): Type[] {
    return Array.from(this._types.values())
  }

  // This is called by the Type constructor.
  _addFieldForType (type: Type, spec: FieldSpec): Field {
    if (!(type instanceof Type)) { throw new Error('Cannot add field: invalid type argument') }
    if (!spec.name) { throw new Error('Cannot add field: name is missing') }
    const address = type.address + '#' + spec.name
    if (this.hasField(address)) {
      return this._fields.get(address)!
      // throw new Error('Field exists: ' + address)
    }
    spec.address = address
    const field = new Field(this, spec)
    this._fields.set(field.address, field)
    return field
  }

  hasField (address: string): boolean {
    try {
      return (this._fields.has(address) ||
                this._fields.has(this.resolveFieldAddress(address)))
    } catch (err) {
      return false
    }
  }

  getField (address: string): Field | undefined {
    return this._fields.get(address) || this._fields.get(this.resolveFieldAddress(address))
  }

  build (strict = true) {
    for (const field of this._fields.values()) {
      field._build(strict)
    }
  }

  toJSON (): SchemaSpec {
    const spec: SchemaSpec = {}
    for (const type of this._types.values()) {
      spec[type.address] = type.toJSON()
    }
    return spec
  }

  addTypes (spec: TypeSpec | any[]) {
    const types = Array.isArray(spec) ? spec : Object.values(spec)
    for (const type of types) {
      this.addType(type, { onchange: false })
    }
    this._onchange(this)
  }
}

function noop () { }

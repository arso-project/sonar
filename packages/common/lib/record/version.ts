import { Schema } from "../schema"
// @ts-ignore
import pretty from 'pretty-hash'
import { inspectSymbol, InspectOptions } from '../util/inspect'
import {SchemaMember} from "../base"
import { Type } from "../type"
import {SC} from "../symbols"
import { Field } from "../field"

export type RecordValue = globalThis.Record<string, any>

export type WireRecordVersion = {
  type: string,
  id: string,
  value: RecordValue | null,

  key?: string,
  seq?: number,
  lseq?: number,

  links?: string[],
  timestamp?: string,
  deleted?: boolean

  meta?: globalThis.Record<string, any>
}

// export class FieldValueSet extends SchemaMember {

//   constructor (schema: Schema) {
//     super(schema)
//   }
// }

export type FieldValueSet = Map<string, any>

export class RecordVersion extends SchemaMember {
  inner: WireRecordVersion
  _type: string
  _fields: FieldValueSet
  built: boolean = false

  constructor (schema: Schema, input: WireRecordVersion | RecordVersion) {
    super(schema)
    if (input instanceof RecordVersion) {
      input = input.inner
    }
    this.inner = input
    this._fields = new Map()
    const type = this.schema.getType(input.type)
    if (!type) {
      throw new Error(`Cannot upcast record: Unknown type "${input.type}"`)
    }
    this._type = type.address
  }

  get value () {
    return this.inner.value!
  }

  get type () {
    // return this.inner.type
    return this._type
  }

  get id () {
    return this.inner.id
  }

  get seq () {
    return this.inner.seq
  }

  get address (): string {
    return this.inner.key + '@' + this.inner.seq
  }

  get shortAddress () {
    return fmtShortAddress(this.address)
  }

  get path () {
    return this.type + '/' + this.id
  }

  get deleted () {
    return this.inner.deleted
  }

  get key () {
    return this.inner.key
  }

  get links () {
    return this.inner.links || []
  }

  get lseq () {
    return this.inner.lseq
  }

  get timestamp () {
    return this.inner.timestamp || 0
  }

  getType (): Type | undefined {
    return this.schema.getType(this.inner.type)
  }

  allTypes (): string[] {
    const type = this.getType()
    if (!type) return []
    return type.allParents()
  }

  hasType (typeAddress: string): boolean {
    typeAddress = this[SC].resolveTypeAddress(typeAddress)
    return this.allTypes().indexOf(typeAddress) !== -1
  }

  update (inputForNextValue: RecordValue) {
    const nextValue = { ...this.value, ...inputForNextValue }
    const nextVersion = {
      type: this.type,
      id: this.id,
      value: nextValue,
      links: [this.address]
    }
    return new RecordVersion(this[SC], nextVersion)
  }

  _build (force = false) {
    if (this.built && !force) return
    const fields = resolveFieldValues(this.schema, this.inner)
    if (fields) this._fields = fields
  }

  hasField (fieldName: string): boolean {
    this._build()
    return !!this.getType()?.hasField(fieldName)
  }

  getField (fieldName: string): Field | undefined {
    this._build()
    return this.getType()?.getField(fieldName)
  }

  getOne (fieldName: string): any {
    this._build()
    const fieldSchema = this.getField(fieldName)
    if (!fieldSchema) return undefined
    return this._fields.get(fieldSchema.address)
  }

  getMany (fieldName: string): Array<any> {
    this._build()
    // const fieldAddress = this.schema.resolveFieldAddress(fieldName)
    // const fieldSchema = this.schema.getField(fieldAddress)
    const fieldSchema = this.getField(fieldName)
    if (!fieldSchema) return []
    const value = this._fields.get(fieldSchema.address)
    if (fieldSchema.multiple) return value
    else return [value]
  }

  // @deprecated use getOne
  get (fieldName: string): any {
    return this.getOne(fieldName)
  }

  fields (): Array<FieldValue> {
    this._build()
    const list = []
    for (const [address, value] of this._fields.entries()) {
      const field = this[SC].getField(address)
      if (field) list.push(new FieldValue(field, value))
    }
    return list
  }

  mapFields (name: string, fn: (field: any) => void) {
    return this.getMany(name).map(fn)
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
      // meta: this.meta
    }
  }

  [inspectSymbol] (depth: number, opts: InspectOptions = { stylize: msg => msg }): string {
    return this.inspect(depth, opts)
  }

  inspect (_depth: number, opts: InspectOptions = { stylize: msg => msg }): string {
    if (!opts.stylize) opts.stylize = (msg: string) => msg
    const { stylize } = opts
    const ind = ' '.repeat(opts.indentationLvl || 0)
    const h = (str: string) => stylize(str, 'special')
    const s = (str: string) => stylize(str, 'string')
    const links = this.links ? this.links.length : 0
    const value = this.deleted
      ? '<deleted>'
      : JSON.stringify(this.value).substring(0, 320)
    const meta =
      s('feed ') +
      h(pretty(this.key)) +
      s('@') +
      this.seq +
      s(' lseq ') +
      (this.lseq || 'n/a') +
      s(' links ') +
      links
    return `${ind}RecordVersion(
${ind}  ${s('type')} ${this.type} ${s('id')} ${this.id}
${ind}  ${s('value')} ${value}
${ind}  ${meta}
${ind})`
  }
}

function resolveFieldValues (schema: Schema, record: WireRecordVersion): FieldValueSet {
  const type = schema.getType(record.type)
  if (!type) return new Map()
  const fields = type.fields()
  if (!record.value) return new Map() 
  const ret = new Map()
  for (const field of fields) {
    if (record.value[field.name] !== undefined) {
      const value = record.value[field.name]
      ret.set(field.address, value)
    }
  }
  return ret
}

function fmtShortAddress (address: string): string {
  const [key, seq] = address.split('@')
  return key.substring(0, 5) + '..' + key.substring(30, 32) + '@' + seq
}

class FieldValue {
  field: Field
  value: any
  constructor(field: Field, value: any) {
    this.field = field
    this.value = value
  }

  get fieldAddress ()  {
    return this.field.address
  }

  values () {
    if (this.value === undefined) return []
    return this.field.multiple ? this.value : [this.value]
  }
}

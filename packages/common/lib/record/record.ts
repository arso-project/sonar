import {SchemaMember} from "../base"
import { Schema } from "../schema"
import {RecordVersion, WireRecordVersion, RecordValue} from "./version"
import Versions from '../versions.js'
import { Emitter, EmitCb} from "../emitter"
import {SC} from "../symbols"
// @ts-ignore
import { inspectSymbol, InspectOptions } from '../util/inspect'

export class Record extends SchemaMember {
  _versions: Versions
  _emitter: Emitter<Record>
  _id?: string
  _type?: string
  constructor (schema: Schema, initialVersion: RecordVersion) {
    super(schema)
    this._emitter = new Emitter(this as Record)
    this._versions = new Versions()
    this.addVersion(initialVersion)
    this._versions.subscribe(() => this.emit())
  }

  emit () {
    this._emitter.emit()
  }

  subscribe (fn: EmitCb<Record>) {
    this._emitter.subscribe(fn)
  }

  versions () {
    return this._versions.current()
  }

  allVersions () {
    return this._versions.all()
  }

  addVersion (recordVersion: RecordVersion | WireRecordVersion) {
    if (!(recordVersion instanceof RecordVersion)) {
      recordVersion = new RecordVersion(this[SC], recordVersion)
    }
    if (!this._id) {
      this._id = recordVersion.id
      this._type = recordVersion.type
    }
    if (recordVersion.path !== this.path) {
      throw new Error('RecordVersion does not match Record path')
    }
    this._versions.put(recordVersion)
  }

  hasVersion (address: string) {
    this._versions.has(address)
  }

  get path () {
    return this._type + '/' + this._id
  }

  get latest (): RecordVersion {
    return this._versions.latest()
  }

  get id () {
    return this.latest.id
  }

  get value () {
    return this.latest.value
  }

  get type () {
    return this.latest.type
  }

  get address () {
    return this.latest.address
  }

  get shortAddress () {
    return this.latest.shortAddress
  }

  get deleted () {
    return this.latest.deleted
  }

  get key () {
    return this.latest.key
  }

  get feed () {
    return this.latest.key
  }

  get seq () {
    return this.latest.seq
  }

  get lseq () {
    return this.latest.lseq
  }

  get timestamp () {
    return this.latest.timestamp
  }

  get links () {
    return this.latest.links
  }

  update (nextValue: RecordValue) {
    return this.latest.update(nextValue)
  }

  getType () {
    return this.latest.getType()
  }

  hasType (typeAddress: string) {
    return this.latest.hasType(typeAddress)
  }

  hasField (fieldName: string) {
    return this.latest.hasField(fieldName)
  }

  getField (fieldName: string) {
    return this.latest.getField(fieldName)
  }

  getOne (fieldName: string): any {
    return this.latest.getOne(fieldName)
  }
  getMany (fieldName: string): any[] {
    return this.latest.getMany(fieldName)
  }

  // @deprecated use getOne
  get (fieldName: string): any {
    return this.latest.getOne(fieldName)
  }

  toJSON () {
    return this.latest.toJSON()
  }
  
  [inspectSymbol] (depth: number, opts: InspectOptions) {
    return this.inspect(depth, opts)
  }
  inspect (_depth: number, opts: InspectOptions = {}): string {
    if (!opts.stylize) opts.stylize = (msg: string) => msg
    const { stylize } = opts
    const ind = ' '.repeat(opts.indentationLvl || 0)
    // const h = (str: string) => stylize(str, 'special')
    const s = (str: string) => stylize(str, 'string')
    return `${ind}Record(
${ind}  ${s('type')} ${this.type} ${s('id')} ${this.id}
${ind}  ${s('versions')} ${this._versions.length} ${s('conflict?')} ${String(this._versions.conflict)}
${ind}  ${s('latest')} ${this.latest.inspect(0, { indentationLvl: ind.length + 2 })}
${ind})`
  }
}

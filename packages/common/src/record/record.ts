import { SchemaMember } from '../base.js'
import { Schema } from '../schema.js'
import { EmitCb } from '../emitter.js'
import { SC } from '../symbols.js'
// @ts-ignore
import { inspectSymbol, InspectOptions } from '../util/inspect'

import { RecordVersion, WireRecordVersion, RecordValue, FieldValue } from './version.js'

export class Record extends SchemaMember {
  private _id?: string
  private _type?: string
  private _versions: Map<string, RecordVersion> = new Map()
  private _current: Set<RecordVersion> = new Set()
  private _outdated: Set<string> = new Set()
  private subscribers: Set<EmitCb<Record>> = new Set()

  constructor (schema: Schema, initialVersion: RecordVersion) {
    super(schema)
    this.addVersion(initialVersion)
  }


  /** Subscribe to changes to this record.
   */
  subscribe (fn: EmitCb<Record>, triggerNow = false): () => void {
    this.subscribers.add(fn)
    if (triggerNow) {
      fn(this)
    }
    return () => { this.subscribers.delete(fn) }
  }

  private _emit () {
    for (const fn of this.subscribers) {
      fn(this)
    }
  }

  get length () {
    return this._versions.size
  }

  get hasConflict () {
    return this._current.size > 1
  }

  currentVersions (): RecordVersion[] {
    return Array.from([...this._current.values()])
  }

  allVersions (): RecordVersion[] {
    return Array.from([...this._versions.values()])
  }

  _latest (): RecordVersion {
    return this.currentVersions().reduce((latest, current) => {
      if (!latest) { return current }
      if (current.timestamp > latest.timestamp) { return current }
      return latest
    })
  }

  hasVersion (version: RecordVersion | string) {
    let versionAddress
    if (version instanceof RecordVersion) {
      versionAddress = version.address
    } else {
      versionAddress = version
    }
    if (this._versions.has(versionAddress)) return true
    return false
  }

  addVersion (version: RecordVersion | WireRecordVersion) {
    if (!(version instanceof RecordVersion)) {
      version = new RecordVersion(this[SC], version)
    }
    if (!this._id) {
      this._id = version.id
      this._type = version.type
    }

    if (this._versions.has(version.address)) return

    if (version.path !== this.path) {
      throw new Error('RecordVersion does not match Record path')
    }

    this._versions.set(version.address, version)

    let isCurrent = true
    if (!version.links) { version.inner.links = [] }
    if (this._outdated.has(version.address)) {
      isCurrent = false
    } else {
      for (const current of this._current) {
        if (current.links?.indexOf(version.address) !== -1) {
          isCurrent = false
        }
      }
    }
    for (const link of version.links) {
      this._outdated.add(link)
    }
    if (isCurrent) {
      for (const link of version.links) {
        if (this._versions.has(link)) {
          this._current.delete(this._versions.get(link)!)
        }
      }
      this._current.add(version)
    }
    this._emit()
  }

  get path () {
    return this._type + '/' + this._id
  }

  get latest (): RecordVersion {
    return this._latest()
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

  fields (): FieldValue[] {
    return this.latest.fields()
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
${ind}  ${s('versions')} ${this.length} ${s('conflict?')} ${String(this.hasConflict)}
${ind}  ${s('latest')} ${this.latest.inspect(0, { indentationLvl: ind.length + 2 })}
${ind})`
  }
}

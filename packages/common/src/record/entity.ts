import { SchemaMember } from '../base'
import { Schema } from '../schema'
import { Record } from './record'

export class Entity extends SchemaMember {
  _records: Set<Record> = new Set()
  _id!: string
  _missing = false
  constructor (schema: Schema, records: Record[]) {
    super(schema)
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

  add (record: Record) {
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

  hasType (typeAddress: string) {
    for (const record of this._records) {
      if (record.hasType(typeAddress)) { return true }
    }
    return false
  }

  getTypes () {
    return Array.from(new Set(Array.from(this._records).map(r => r.getType())))
  }

  getMany (fieldName: string): any[] {
    const fieldValues = []
    for (const record of this._records) {
      fieldValues.push(...record.getMany(fieldName))
    }
    return fieldValues
  }

  get (fieldName: string): any {
    const fieldValues = this.getMany(fieldName)
    if (fieldValues.length > 0) {
      return fieldValues[0]
    } else {
      return undefined
    }
  }
}

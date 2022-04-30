import { Entity, Record, RecordVersion } from './index.js'
import { WireRecordVersion } from './record/version.js'
import type { Schema } from './schema.js'

export interface StoreArgs {
  schema: Schema
}

export class Store {
  private _opts: StoreArgs
  private _schema: Schema
  private _records = new Map<string, Record>()
  private _entities = new Map<string, Entity>()
  private _versions = new Map<string, RecordVersion>()

  constructor (opts: StoreArgs) {
    this._opts = opts
    this._schema = opts.schema
  }

  records () {
    return Array.from(this._records.values())
  }

  entities () {
    return Array.from(this._entities.values())
  }

  getEntity (id: string): Entity|undefined {
    return this._entities.get(id)
  }

  getRecord (path: string): Record | undefined {
    return this._records.get(path)
  }

  getRecordVersion (address: string): RecordVersion | undefined {
    return this._versions.get(address)
  }

  cacheRecord (recordVersion: Record | RecordVersion | WireRecordVersion): Record {
    // TODO: Rethink if we want this.
    if (recordVersion instanceof Record) {
      for (const version of recordVersion.allVersions()) {
        this.cacheRecord(version)
      }
      return this.getRecord(recordVersion.path)!
    }
    if (!(recordVersion instanceof RecordVersion)) {
      recordVersion = new RecordVersion(this._schema, recordVersion)
    }
    if (this._records.has(recordVersion.path)) {
      this._records.get(recordVersion.path)!.addVersion(recordVersion)
    } else {
      const record = new Record(this._schema, recordVersion)
      this._records.set(record.path, record)
      if (!this._entities.has(record.id)) {
        const entity = new Entity(this._schema, [record])
        this._entities.set(entity.id, entity)
      } else {
        const entity = this._entities.get(record.id)!
        entity.add(record)
      }
    }
    const record = this._records.get(recordVersion.path)!
    this._versions.set(recordVersion.address, recordVersion)
    return record
  }
}

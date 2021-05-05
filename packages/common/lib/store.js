const { Entity, Record, RecordVersion } = require('./records')
module.exports = class Store {
  constructor (opts = {}) {
    this._opts = opts
    this._schema = opts.schema
    this._records = new Map()
    this._entities = new Map()
    this._versions = new Map()
  }

  records () {
    return Array.from(this._records.values())
  }

  entities () {
    return Array.from(this._entities.values())
  }

  getEntity (id) {
    return this._entities.get(id)
  }

  getRecord (path) {
    return this._records.get(path)
  }

  getRecordVersion (address) {
    return this._versions.get(address)
  }

  cacheRecord (recordVersion) {
    // TODO: Rethink if we want this.
    if (recordVersion instanceof Record) {
      for (const version of recordVersion.allVersions()) {
        this.cacheRecord(version)
      }
      return this.getRecord(recordVersion.path)
    }

    if (!(recordVersion instanceof RecordVersion)) {
      recordVersion = new RecordVersion(this._schema, recordVersion)
    }

    if (this._records.has(recordVersion.path)) {
      this._records.get(recordVersion.path).addVersion(recordVersion)
    } else {
      const record = new Record(this._schema, recordVersion)
      this._records.set(record.path, record)

      if (!this._entities.has(record.id)) {
        const entity = new Entity(this._schema, [record])
        this._entities.set(entity.id, entity)
      } else {
        const entity = this._entities.get(record.id)
        entity.add(record)
      }
    }

    const record = this._records.get(recordVersion.path)
    this._versions.set(recordVersion.address, recordVersion)
    return record
  }
}

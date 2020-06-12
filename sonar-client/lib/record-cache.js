const { Transform } = require('streamx')

module.exports = class RecordCache {
  constructor () {
    this.reset()
  }

  reset () {
    this._records = new Map()
    this._byId = new Map()
  }

  batch (records) {
    for (const [i, record] of records.entries()) {
      if (record.value) this.add(record)
      else {
        records[i] = this.upgrade(record)
      }
    }
    return records
  }

  add (record) {
    const cacheid = this.cacheid(record)
    this._records.set(cacheid, record)
    const id = record.id
    if (!this._byId.get(id)) this._byId.set(id, [])
    this._byId.get(id).push(cacheid)
  }

  getById (id) {
    if (!this._byId.has(id)) return []
    return Array.from(this._byId.get(id))
  }

  has (req) {
    if (req.key === undefined || req.seq === undefined) return false
    const cacheid = this.cacheid(req)
    return this._records.has(cacheid)
  }

  upgrade (record) {
    const cacheid = this.cacheid(record)
    if (this.records[cacheid]) {
      return Object.assign({}, this.records[cacheid], record)
    }
    return record
  }

  transformStream () {
    const self = this
    return new Transform({
      transform (record, next) {
        record = self.upgrade(record)
        this.push(record)
        next()
      }
    })
  }

  cacheid (record) {
    return record.key + '@' + record.seq
  }
}

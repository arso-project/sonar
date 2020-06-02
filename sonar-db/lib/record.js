const { Record: RecordEncoding } = require('./messages')

module.exports = class Record {
  static get PUT () { return RecordEncoding.Op.PUT }
  static get DEL () { return RecordEncoding.Op.DEL }

  static decode (buf, props = {}) {
    let record = RecordEncoding.decode(buf)
    record.value = Record.decodeValue(record)

    // Assign key and seq if provided (these are not part of the encoded record, but
    // must be provided when loading the record from the feed).
    if (props.key) {
      record.key = Buffer.isBuffer(props.key) ? props.key.toString('hex') : props.key
    }
    if (typeof props.seq !== 'undefined') {
      record.seq = Number(props.seq)
    }
    record = { ...props, ...record }
    return record
  }

  static encode (record) {
    const value = Record.encodeValue(record)
    const buf = RecordEncoding.encode({ ...record, value })
    return buf
  }

  static decodeValue (record) {
    if (record.value) return JSON.parse(record.value)
    return null
  }

  static encodeValue (record) {
    if (record.value) return JSON.stringify(record.value)
    return null
  }
}


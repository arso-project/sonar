const { Record: RecordEncoding } = require('./messages')

module.exports = class RecordEncoder {
  static decode (buf, props = {}) {
    let record = RecordEncoding.decode(buf)
    record.value = RecordEncoder.decodeValue(record)

    // Assign key and seq if provided (these are not part of the encoded record, but
    // must be provided when loading the record from the feed).
    if (props.key) {
      props.key = Buffer.isBuffer(props.key)
        ? props.key.toString('hex')
        : props.key
    }
    if (typeof props.seq !== 'undefined') {
      props.seq = Number(props.seq)
    }
    record = { ...props, ...record }
    return record
  }

  static encode (record) {
    const value = RecordEncoder.encodeValue(record)
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

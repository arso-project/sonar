const Record = require('../lib/record')
module.exports = { mapRecordsIntoLevelDB }

function mapRecordsIntoLevelDB (opts, next) {
  const { records, map, level, db } = opts
  let pending = records.length
  const ops = []

  records.forEach(record => collectOps(db, record, map, done))

  function done (err, curOps) {
    if (!err) ops.push(...curOps)
    if (--pending === 0) finish()
  }

  function finish () {
    level.batch(ops, next)
  }
}

function collectOps (db, record, mapFn, cb) {
  const ops = []
  // check if the current record is already outdated,
  // this means do nothing.
  db.api.kv.isLinked(record, (err, isLinked) => {
    if (err) return cb(err)
    if (isLinked) return cb(null, [])

    // check if we have to delete other records because they are
    // linked to by this record.
    collectLinkedRecords(db, record, (err, linkedRecords) => {
      if (err) return cb(null, [])

      // map linked records to delete ops
      for (const linkedRecord of linkedRecords) {
        Array.prototype.push.apply(ops, mapToDel(db, linkedRecord, mapFn))
      }

      // map the current record itself
      if (record.op === Record.PUT) {
        Array.prototype.push.apply(ops, mapToPut(db, record, mapFn))
      } else if (record.op === Record.DEL) {
        Array.prototype.push.apply(ops, mapToDel(db, record, mapFn))
      }

      cb(null, ops)
    })
  })
}

function collectLinkedRecords (db, record, cb) {
  if (!record.links.length) return cb(null, [])
  const records = []
  let pending = record.links.length
  record.links.forEach(link => {
    var [key, seq] = link.split('@')
    db.loadRecord({ key, seq }, (err, record) => {
      if (!err && record) records.push(record)
      if (--pending === 0) cb(null, records)
    })
  })
}

function mapToPut (db, record, mapFn) {
  let ops = mapFn(record, db)
  return mapResult(ops, 'put')
}

function mapToDel (db, record, mapFn) {
  let ops = mapFn(record, db)
  return mapResult(ops, 'del')
}

function mapResult (ops, type) {
  if (!ops) return []
  if (!Array.isArray(ops)) ops = [ops]
  return ops.map(op => {
    if (typeof op === 'string') op = { key: op }
    if (type === 'put' && !op.value) op.value = ''
    op.type = type
    return op
  })
}

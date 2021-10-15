const through = require('through2')
const { Readable } = require('streamx')
const keyEncoding = require('charwise')
const {
  mapRecordsIntoOps,
  clearLevelDb
} = require('./helpers')
const Live = require('@frando/level-live')
// const debug = require('debug')('db')
// const collect = require('stream-collector')

const INDEXES = {
  is: ['id', 'type', 'key'],
  si: ['type', 'id', 'key']
}

module.exports = function createRecordView (lvl, db, opts) {
  const schema = opts.schema
  return {
    map (records, next) {
      mapRecordsIntoOps(db, records, mapToPutOp, (err, ops) => {
        if (err) return next(err)
        lvl.batch(ops, next)
      })
    },

    reset (cb) {
      clearLevelDb(lvl, cb)
    },

    api: {
      query (req, opts = {}) {
        if (!req) return this.view.all(opts)
        if (req.path) {
          const [typens, typename, id] = req.path.split('/')
          req.type = typens + '/' + typename
          req.id = id
        }
        if (req.lseq) {
          const stream = new Readable()
          stream.push(req)
          stream.push(null)
          return stream
        }
        if (typeof req === 'string') req = { id: req }
        let { type, id, key, seq, all } = req

        if (type) type = schema.resolveTypeAddress(type)

        let filter
        if (all) {
          filter = includerange(['is'])
        } else if (type && !id) {
          filter = includerange(['si', type])
        } else if (!type && id) {
          filter = includerange(['is', id])
        } else {
          filter = includerange(['is', id, type])
        }

        let rs = query(lvl, { ...opts, ...filter })
        if (key) rs = rs.pipe(filterSource(key, seq))
        return rs
      },

      get (req, opts) {
        return this.view.query(req, opts)
      },

      all (cb, opts) {
        return query(lvl, includerange(['is']), opts)
      },

      byType (type, opts) {
        return this.view.query({ type }, opts)
      },

      byId (id, opts) {
        return this.view.query({ id }, opts)
      },

      byIdAndSchema (id, type, opts) {
        return this.view.query({ id, type }, opts)
      }
    }
  }
}

function query (db, opts) {
  opts.keyEncoding = keyEncoding
  const transform = parseRow()
  let rs
  if (opts.live) {
    rs = new Live(db, opts)
    rs.once('sync', () => transform.emit('sync'))
  } else {
    rs = db.createReadStream(opts)
  }
  return rs.pipe(transform)
}

function validate (msg) {
  const result = msg.id && msg.type && msg.key && typeof msg.seq !== 'undefined'
  return result
}

function mapToPutOp (msg, db) {
  if (!validate(msg)) return []
  const ops = []
  const value = msg.seq || 0
  const shared = { value, keyEncoding }
  Object.entries(INDEXES).forEach(([key, fields]) => {
    fields = fields.map(field => msg[field])
    ops.push({
      key: [key, ...fields],
      ...shared
    })
  })
  return ops
}

function parseRow () {
  return through.obj(function (row, enc, next) {
    const { key, value: seq } = row
    const idx = key.shift()
    const index = INDEXES[idx]
    if (!index) return next()
    const record = { seq: Number(seq) }
    for (let i = 0; i < key.length; i++) {
      record[index[i]] = key[i]
    }
    this.push(record)
    next()
  })
}

function filterSource (key, seq) {
  return through.obj(function (row, enc, next) {
    if (row.key === key) {
      if (!seq || seq === row.seq) this.push(row)
    }
    next()
  })
}

function includerange (key) {
  return {
    gte: [...key],
    lte: [...key, undefined]
  }
}

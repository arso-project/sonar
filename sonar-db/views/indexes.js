const through = require('through2')

const { mapRecordsIntoOps } = require('./helpers')

const CHAR_END = '\uffff'
const CHAR_SPLIT = '\u0000'
const CHAR_START = '\u0001'

module.exports = function indexedView (lvl, db, opts) {
  const schema = opts.schema
  return {
    name: 'indexes',
    map (records, next) {
      mapRecordsIntoOps(db, records, mapToIndex, (err, ops) => {
        lvl.batch(ops, next)
      })
    },
    api: {
      query (kappa, opts, cb) {
        // const { type, prop, value, gt, lt, gte, lte, reverse, limit } = opts
        const proxy = transform(opts)
        if (!opts.type || !opts.field) {
          proxy.destroy(new Error('type and field are required.'))
        } else {
          opts.type = schema.resolveTypeAddress(opts.type)
          if (!opts.type) return proxy.destroy(new Error('Unknown type: ' + opts.type))
          const lvlopts = queryOptsToLevelOpts(opts)
          lvl.createReadStream(lvlopts).pipe(proxy)
        }
        return proxy
      }
    }
  }

  function mapToIndex (msg, db) {
    const record = schema.Record(msg)
    const lseq = record.lseq
    const ops = []
    for (const fieldValue of record.fields()) {
      const field = fieldValue.field
      if (fieldValue.empty() || !field.index.basic) continue
      const fieldAddress = fieldValue.address
      const value = fieldValue.value
      ops.push({
        key: [fieldAddress, value, lseq].join(CHAR_SPLIT),
        value: ''
      })
    }
    return ops
  }
}

function queryOptsToLevelOpts (schema, opts) {
  let { field, reverse, limit, offset, value, gt, gte, lt, lte } = opts
  // TODO: This will throw for invalid fields names.
  const fieldAddress = schema.resolveFieldAddress(field)
  if (offset && limit) limit = limit + offset
  const lvlopts = { reverse, limit }
  const key = fieldAddress + CHAR_SPLIT
  lvlopts.gt = key + CHAR_SPLIT
  lvlopts.lt = key + CHAR_END
  if (value) {
    lvlopts.gt = key + value + CHAR_SPLIT
    lvlopts.lt = key + value + CHAR_SPLIT + CHAR_END
  } else if (gt) {
    lvlopts.gt = key + gt + CHAR_SPLIT
    lvlopts.lt = key + gt + CHAR_END
  } else if (gte) {
    lvlopts.gte = key + gte + CHAR_SPLIT
    lvlopts.lt = key + gte + CHAR_END
  }
  if (lt) {
    lvlopts.lt = key + lt + CHAR_START
  } else if (lte) {
    lvlopts.lt = undefined
    lvlopts.lte = key + lte + CHAR_END
  }
  return lvlopts
}

function transform (opts) {
  const offset = opts.offset || null
  let i = 0
  return through.obj(function (row, enc, next) {
    i += 1
    if (offset && i < offset) return next()
    const decoded = decodeNode(row)
    this.push(decoded)
    next()
  })
}

function decodeNode (node) {
  const [, , lseq] = node.key.split(CHAR_SPLIT)
  // return { schema, id, key: source, seq, params: { prop, value } }
  return { lseq }
}

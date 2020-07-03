const { QuadStore } = require('quadstore')
const { Transform } = require('stream')
// const SparqlEngine = require('quadstore-sparql');

module.exports = class Relations {
  constructor (db, opts) {
    this.db = db
    this.opts = opts
    this.flows = {}
    this.store = new QuadStore(db, opts)
    // this.sparql = new SparqlEngine(this.store)
  }

  createView (collection) {
    const self = this
    return () => ({
      map (messages, cb) {
        self._map(collection, messages, cb)
      },
      reset (cb) {
        const match = { graph: collection.key.toString('hex') }
        self.store.del(match, cb)
      },
      api: {
        query (kappa, query, opts) {
          return self._query(collection, query, opts)
        }
      }
    })
  }

  _map (collection, messages, cb) {
    const quads = []
    for (const message of messages) {
      quads.push(...messageToQuads(collection, message))
    }
    if (!quads.length) return cb()
    this.store.put(quads, (err) => {
      cb(err)
    })
  }

  _query (collection, query, cb) {
    query.graph = collection.key.toString('hex')
    const quadStream = this.store.getStream(query)
    const transform = new Transform({
      objectMode: true,
      transform (quad, _enc, next) {
        collection.get({ id: quad.subject }, (err, records) => {
          if (err || !records.length) return next()
          const record = records[0]
          this.push({
            lseq: record.lseq,
            meta: {
              predicate: quad.predicate,
              object: quad.object
            }
          })
          next()
        })
      }
    })
    const resultStream = quadStream.pipe(transform)
    return resultStream
  }
}

function messageToQuads (collection, message, cb) {
  const quads = []
  const graph = collection.key.toString('hex')
  const relationValues = message.fields().filter(fieldValue => {
    return fieldValue.fieldType === 'relation'
  })
  for (const fieldValue of relationValues) {
    for (const value of fieldValue.values()) {
      quads.push({
        subject: message.id,
        predicate: fieldValue.fieldAddress,
        object: value,
        graph
      })
    }
  }
  return quads
}

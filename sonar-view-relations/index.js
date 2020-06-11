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
  const schema = collection.getSchema(message.schema)
  if (!schema) return []
  // console.log('map', message.id, message.schema, schema)
  const quads = []
  const subject = message.id
  const graph = collection.key.toString('hex')
  for (const { field, name, value } of fields(schema, message)) {
    // console.log({ name, value, field })
    if (!field.index || !field.index.relation) continue
    if (!Array.isArray(value)) continue
    for (const item of value) {
      quads.push({
        subject,
        predicate: name,
        object: item,
        graph
      })
    }
  }
  return quads
}

function fields (schema, message) {
  if (!schema.properties || !message.value) return []
  const fields = []
  for (const [name, field] of Object.entries(schema.properties)) {
    fields.push({
      name: schema.name + '#' + name,
      value: message.value[name],
      field
    })
  }
  return fields
}

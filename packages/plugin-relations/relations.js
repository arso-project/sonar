const { Quadstore } = require('quadstore')
const { Transform, Readable } = require('streamx')
const { parseAddress } = require('@arsonar/common/lib/address')
const { batchToDiff } = require('@arsonar/core/lib/utils/batch-diff')

// HACK: Quadstore is not compatible with subleveldown
function monkeypatchSublevelStatus (db) {
  if (!db.status && db.db) {
    Object.defineProperty(db, 'status', {
      get: () => db.db.status
    })
  }
}

module.exports = class Relations {
  constructor (db, opts = {}) {
    monkeypatchSublevelStatus(db)
    const quadstoreOpts = {
      backend: db
    }
    this.store = new Quadstore(quadstoreOpts)
    this.df = this.store.dataFactory
  }

  createView (collection) {
    const self = this
    return {
      version: 2,
      open (_flow, cb) {
        self.store.open().then(cb, cb)
      },
      async map (batch) {
        return self._map(collection, batch)
      },
      reset (cb) {
        const graph = self.df.namedNode(collection.id)
        const stream = self.store.removeMatches(null, null, null, graph)
        stream.on('end', cb)
        stream.on('error', cb)
      },
      api: {
        query (query, opts) {
          return self._query(collection, query, opts)
        }
      }
    }
  }

  async _map (collection, batch) {
    const { left, right } = await batchToDiff(collection, batch)
    const putQuads = recordsToQuads(this.df, collection, right)
    const delQuads = recordsToQuads(this.df, collection, left)
    await this.store.multiPatch(delQuads, putQuads)
  }

  _query (collection, query, cb) {
    return quadstoreMatchQuery(collection, this.store, query)
  }
}

function quadstoreMatchQuery (collection, store, query) {
  const match = upcastQuery(store.dataFactory, collection, query)
  const quadStream = new QuadstoreMatchQueryStream(store, match)
  const proxy = new QuadToRecordStream(collection)
  return quadStream.pipe(proxy)
}

class QuadstoreMatchQueryStream extends Readable {
  constructor (store, query) {
    super()
    this.query = query
    this.store = store
  }

  _open (cb) {
    this.store
      .getStream(this.query)
      .catch(err => cb(err))
      .then(result => {
        const { iterator } = result
        // this is an uncommon stream/iterator that has no pipe method
        // and also is not a native AsyncIterator.
        // see docs here https://www.npmjs.com/package/asynciterator
        // TODO: See how to properly convert to streamx
        iterator.on('data', quad => this.push(quad))
        iterator.on('end', () => this.push(null))
        cb()
      })
  }
}

class QuadToRecordStream extends Transform {
  constructor (collection, opts) {
    super(opts)
    this.collection = collection
  }

  _transform (quad, cb) {
    const id = quad.subject.value
    const type = typeFromPredicate(quad)
    const meta = {
      predicate: quad.predicate.value,
      object: quad.object.value
    }
    cb(null, { id, type, meta })
  }
}

function upcastQuery (df, collection, query) {
  if (query.subject) query.subject = df.namedNode(query.subject)
  if (query.object) query.object = df.namedNode(query.object)
  if (query.predicate) {
    const resolved = collection.schema.resolveFieldAddress(query.predicate)
    query.predicate = df.namedNode(resolved)
  }
  query.graph = df.namedNode(collection.id)
  return query
}

function typeFromPredicate (quad) {
  const { namespace, type } = parseAddress(quad.predicate.value)
  return `${namespace}/${type}`
}

function recordsToQuads (df, collection, records) {
  return records.map(record => recordToQuads(df, collection, record)).flat()
}

function recordToQuads (df, collection, record) {
  const quads = []
  const graph = df.namedNode(collection.id)
  const relationValues = record.fields().filter(fieldValue => {
    return fieldValue.fieldType === 'relation'
  })
  for (const fieldValue of relationValues) {
    for (const value of fieldValue.values()) {
      quads.push(
        df.quad(
          df.namedNode(record.id),
          df.namedNode(fieldValue.fieldAddress),
          df.namedNode(value),
          graph
        )
      )
    }
  }
  return quads
}

// getRecordsFromQuad(this.collection, quad)
//   .catch(cb)
//   .then(records => {
//     for (const record of records) {
//       record.meta = {
//         predicate: quad.predicate.value,
//         object: quad.object.value
//       }
//       this.push(record)
//     }
//     cb()
//   })
// async function getRecordsFromQuad (collection, quad) {
//   const id = quad.subject.value
//   const type = typeFromPredicate(quad)
//   try {
//     return await collection.get({ type, id })
//   } catch (err) {
//     return []
//   }
// }

const Sonar = require('@arso-project/sonar-tantivy')
const { Readable } = require('stream')
// const debug = require('debug')('sonarview')
const through = require('through2')

module.exports = sonarView
const IndexManager = require('./index-manager')

const log = require('./log').child({ component: 'view-sonar' })
const { clock } = require('./log')

function sonarView (lvl, cstore, opts) {
  const catalog = new Sonar(opts.storage || '.tantivy')
  const manager = new IndexManager(lvl, catalog)
  const schemas = {}

  return {
    batch: true,
    batchSize: 500,
    map (msgs, next) {
      const time = clock()
      // console.log('NEXT', typeof timeout)
      // buf.push(...msgs)
      // if (!timeout) timeout = setTimeout(() => flush(), 250)
      // next()
      _map(msgs)
        .then(res => {
          log.debug('Indexed %d records [time: %s]', msgs.length, time(), res)
          next(null, res)
        })
        .catch(err => {
          log.error(err)
          next(err)
        })
    },
    api: {
      catalog,
      manifest: {
        info: 'promise',
        query: 'streaming'
      },
      async info (kcore, args, cb) {
        const info = await manager.getInfo()
        return info
      },
      // TODO: Make really streaming.
      query (kcore, args, cb) {
        const time = clock()

        const stream = new Readable({
          objectMode: true,
          read () {}
        })

        let { query, index } = args
        index = index || 'textdump'

        _query({ query, index, snippetField: 'body' })
          .then(results => {
            results.forEach(result => {
              stream.push(result)
            })
            stream.push(null)
            log.debug('query "%s" on %s: %d results [time: %s]', query, index, results.length, time())
          })
          .catch(err => console.error(err))
        const transform = through.obj(function (row, enc, next) {
          const record = {
            value: {
              title: row.doc.title && row.doc.title[0],
              body: row.doc,
              score: row.score,
              snippet: row.snippet
            },
            // schema: 'arso.xyz/SearchResult',
            schema: row.doc.schema && row.doc.schema[0],
            id: row.doc.id && row.doc.id[0],
            source: row.doc.source && row.doc.source[0]
          }
          // const record = {
          //   value: {
          //     body: row.doc.body,
          //     score: row.score
          //   },
          //   id: row.doc.id[0],
          //   source: row.doc.source[0],
          //   schema: 'arso.xyz/SearchResult'
          // }
          this.push(record)
          next()
        })
        return stream.pipe(transform)
      }
    }
  }

  async function _query (opts) {
    // console.log('QUERY', opts)
    let { query, index: indexKey, snippetField } = opts
    // indexKey = 'textdump'
    // await manager.ready()
    const index = await manager.get(indexKey)
    // console.log('GOT INDEX', index)
    const results = await index.query(query, { snippetField })
    return results
  }

  async function _map (msgs) {
    await manager.ready()

    const docs = {
      textdump: []
    }

    for (let msg of msgs) {
      // console.log('map', msg)
      try {
        let { schema: schemaName, id, value, source } = msg

        let body = objectToString(value)
        // for (let [name, def] of Object.entries(schema.properties)) {
        //   if (def.type === 'string') {
        //     body = body + ' ' + value[name]
        //   }
        // }
        let title
        if (value.title) title = objectToString(value.title)
        else if (value.label) title = objectToString(value.label)

        docs.textdump.push({ body, title, id, source, schema: schemaName })

        const schema = await loadSchema(schemaName, msg)
        if (!schema) continue

        await manager.make(schemaName, schema)

        let indexSchema = manager.getSchema(schemaName)
        let fields = indexSchema.map(f => f.name)

        const doc = Object.entries(value).reduce((acc, [key, value]) => {
          if (fields.indexOf(key) !== -1) acc[key] = value
          return acc
        }, {})

        doc.id = id
        doc.source = source
        doc.schema = schemaName
        // console.log('index', schema, doc)

        docs[schemaName] = docs[schemaName] || []
        docs[schemaName].push(doc)
      } catch (e) {
        // TODO: What's the right way to handle errors at this level?
        console.error('ERROR', e)
      }
    }

    let ret = {}
    for (let [schemaName, currentDocs] of Object.entries(docs)) {
      let index = await manager.get(schemaName)
      try {
        // console.log('push to', schemaName, currentDocs)
        await index.addDocuments(currentDocs)
        ret[schemaName] = currentDocs.length
      } catch (e) {
        // log.error(e)
        console.log('sonar error', e)
      }
    }
    return ret
  }

  function loadSchema (name, record) {
    if (!schemas[name]) {
      schemas[name] = new Promise((resolve, reject) => {
        cstore.getSchema(name, (err, schema) => {
          // if (err) reject(err)
          if (schema) resolve(schema)
          else resolve(null)

          // TODO: Re-add and test this.
          // else if (record) {
          //   schema = deriveSchema(record)
          //   resolve(schema)
          // } else resolve(null)
        })
      })
    }
    return schemas[name]
  }
}

function objectToString (obj) {
  if (typeof obj === 'string' || typeof obj === 'number') {
    return obj
  } else if (Array.isArray(obj)) {
    return obj.map(objectToString).join(' ')
  } else if (!obj) {
    return ''
  } else if (typeof obj === 'object') {
    if (obj.value) return objectToString(obj.value)
    return Object.values(obj).map(objectToString).join(' ')
  }
  return ''
}


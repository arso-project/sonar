const IndexManager = require('./index-manager')
const doQuery = require('./query')

const log = require('../log').child({ component: 'view-sonar' })
const { clock } = require('../log')

module.exports = sonarView

function sonarView (level, island, opts) {
  const manager = new IndexManager({
    level,
    namespace: island.key.toString('hex'),
    catalog: opts.indexCatalog
  })

  const schemas = {}

  return {
    version: 2,
    batch: true,
    batchSize: 500,
    map,
    // close: (cb) => manager.closeIndex(cb),
    api: {
      info (kcore, args, cb) {
        manager.getInfo()
          .then(info => cb(null, info))
          .catch(err => cb(err))
      },
      query (kcore, query, opts = {}) {
        const resultStream = doQuery(manager, query, opts.indexName)
        return resultStream
      }
    }
  }

  async function map (msgs, next) {
    const time = clock()
    await manager.ready()

    const schemas = island.getSchemas()

    const docs = {
      textdump: []
    }

    for (const msg of msgs) {
      try {
        await pushToTexdump(msg)
        await pushToNamedIndex(msg)
      } catch (err) {
        log.error('Could not prepare message:', msg, err)
      }
    }

    for (const [schemaName, currentDocs] of Object.entries(docs)) {
      const index = await manager.get(schemaName)
      try {
        await index.addDocuments(currentDocs)
      } catch (e) {
        log.error(e)
        return next(e)
      }
    }

    log.debug('Indexed %d records [time: %s]', msgs.length, time())

    next()

    async function pushToTexdump (msg) {
      const { schema: schemaName, id, value, key: source, seq } = msg
      const body = objectToString(value)
      let title = ''
      if (value.title) title = objectToString(value.title)
      else if (value.label) title = objectToString(value.label)

      docs.textdump.push({ body, title, id, source, seq, schema: schemaName })
    }

    async function pushToNamedIndex (msg) {
      const { schema: schemaName, id, value, key: source, seq } = msg
      // const schema = await loadSchema(schemaName, msg)
      const schema = schemas[schemaName]
      if (!schema) return

      await manager.make(schemaName, schema)

      const indexSchema = manager.getSchema(schemaName)
      const fields = indexSchema.map(f => f.name)

      const doc = Object.entries(value).reduce((acc, [key, value]) => {
        if (fields.indexOf(key) !== -1) acc[key] = value
        return acc
      }, {})

      doc.id = id
      doc.source = source
      doc.seq = seq
      doc.schema = schemaName
      // console.log('index', schema, doc)

      docs[schemaName] = docs[schemaName] || []
      docs[schemaName].push(doc)
    }
  }

  function loadSchema (name, record) {
    if (!schemas[name]) {
      schemas[name] = new Promise((resolve, reject) => {
        island.getSchema(name, (err, schema) => {
          if (err) reject(err)
          if (schema) resolve(schema)
          else resolve(null)
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

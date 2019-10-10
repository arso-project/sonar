const { Readable } = require('stream')
const through = require('through2')
const log = require('../log').child({ component: 'view-sonar' })
const { clock } = require('../log')

module.exports = function query (indexManager, args) {
  let { query, index: indexName } = args
  indexName = indexName || 'textdump'
  const resultStream = executeQuery(indexManager, indexName, query)
  const transform = transformResults()

  resultStream.on('error', err => transform.destroy(err))

  return resultStream.pipe(transform)
}

function executeQuery (manager, indexName, query) {
  const snippetField = 'body'
  const stream = new Readable({
    objectMode: true,
    read () {}
  })
  start()
  return stream

  async function start () {
    const time = clock()
    try {
      const index = await manager.get(indexName)
      const results = await index.query(query, { snippetField })

      results.forEach(result => {
        stream.push(result)
      })
      stream.push(null)
      log.debug('query "%s" on %s: %d results [time: %s]', query, index, results.length, time())
    } catch (err) {
      stream.destroy(err)
    }
  }
}

function transformResults () {
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
    this.push(record)
    next()
  })
  return transform
}

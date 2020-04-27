const { Readable } = require('stream')
const through = require('through2')
// const log = require('../../lib/log').child({ component: 'view-sonar' })
const debug = require('debug')('sonar-core:search')
const { clock } = require('../../lib/log')

module.exports = function doQuery (indexManager, query, indexName) {
  indexName = indexName || 'textdump'
  const resultStream = executeQuery(indexManager, query, indexName)
  const transform = transformResults()

  resultStream.on('error', err => transform.destroy(err))

  return resultStream.pipe(transform)
}

function executeQuery (indexManager, query, indexName) {
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
      const index = await indexManager.get(indexName)
      let results

      if (typeof query === 'string') {
        results = await index.query(query, { snippetField })
      } else {
        results = await index.queryJson(query, { snippetField })
        results = results.docs
      }

      results.forEach(result => stream.push(result))
      stream.push(null)
      debug('query with %d results (time %s, index %s, query %o)', results.length, time(), index.name, query)
    } catch (err) {
      stream.destroy(err)
    }
  }
}

function transformResults () {
  const transform = through.obj(function (row, enc, next) {
    const record = {
      key: row.doc.source && row.doc.source[0],
      seq: row.doc.seq && row.doc.seq[0],
      meta: {
        snippet: row.snippet,
        score: row.score
      }
    }
    this.push(record)
    next()
  })
  return transform
}

const { Readable } = require('stream')
const through = require('through2')
const debug = require('debug')('sonar-core:search')
// const log = require('../../lib/log').child({ component: 'view-sonar' })
const { clock } = require('./util')

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
      debug(
        'query with %d results (time %s, index %s, query %o)',
        results.length,
        time(),
        index.name,
        query
      )
    } catch (err) {
      console.error('err', err)
      stream.destroy(err)
    }
  }
}

function transformResults () {
  const transform = through.obj(function (row, enc, next) {
    const { doc, score, snippet } = row
    const key = Array.isArray(doc.source) ? doc.source[0] : doc.source
    const seq = Array.isArray(doc.seq) ? doc.seq[0] : doc.seq
    const record = {
      key,
      seq,
      meta: {
        snippet,
        score
      }
    }
    this.push(record)
    next()
  })
  return transform
}

const SseStream = require('ssestream').default
const express = require('express')
const split2 = require('split2')
const { pipeline } = require('streamx')
const { HttpError } = require('../lib/util')
const AH = require('../lib/async-handler')

const WAIT_TIMEOUT = 1000

module.exports = function createCollectionRoutes () {
  const router = express.Router()

  router.post(
    '/',
    AH(async (req, res, next) => {
      const { name, key, alias } = req.body
      const opts = { alias, name }
      const collection = await req.workspace.createCollection(key || name, opts)
      await collection.open()
      return collection.status()
    })
  )

  router.use(
    '/:collection',
    AH(async (req, res, next) => {
      const { collection: keyOrName } = req.params
      if (!keyOrName) return next()
      const collection = await req.workspace.openCollection(keyOrName)
      req.collection = collection
      next()
    })
  )

  router.get(
    '/:collection',
    AH(async (req, res, next) => {
      const status = await req.collection.status()
      const schema = req.collection.schema.toJSON()
      return {
        ...status,
        schema
      }
    })
  )

  router.patch(
    '/:collection',
    AH(async (req, res, next) => {
      await req.collection.configure(req.body)
      const config = req.collection.getConfig()
      return config
    })
  )

  router.post(
    '/:collection',
    AH(async (req, res, next) => {
      let record
      // If called with ?batch=1, accept a stream of newline-delimited JSON objects
      // and put each as a record.
      if (req.query.batch) {
        const batchStream = req.collection.createBatchStream()
        pipeline(req, split2(JSON.parse), batchStream, err => {
          if (err) next(err)
          else res.send({ done: true })
        })
        return
      }

      // Currently, two forms are accepted:
      // a) JSON body with an object `{ id, type, value }`
      // b) JSON body with just the value, and query parameters for type and id
      if (req.query.type && req.query.id) {
        record = {
          id: req.query.id,
          type: req.query.type,
          value: req.body
        }
      } else {
        record = req.body
      }
      const createdRecord = await req.collection.put(record)
      return createdRecord.toJSON()
    })
  )

  router.delete(
    '/:collection/record/:typens/:typename/:id',
    AH(async (req, res, next) => {
      const { id, typens, typename } = req.params
      const type = typens + '/' + typename
      await req.collection.del({ id, type })
      return { id, type, deleted: true }
    })
  )

  router.delete(
    '/:collection/entity/:id',
    AH(async (req, res, next) => {
      const { id } = req.params
      await req.collection.del({ id })
      return { id, deleted: true }
    })
  )

  router.get(
    '/:collection/entity/:id',
    AH(async (req, res, next) => {
      const { id } = req.params
      const records = await req.collection.get({ id })
      return records.map(r => r.toJSON())
    })
  )

  router.get(
    '/:collection/record/:typens/:typename/:id',
    AH(async (req, res, next) => {
      const { id, typens, typename } = req.params
      const type = typens + '/' + typename
      const records = await req.collection.get({ id, type })
      return records.map(r => r.toJSON())
    })
  )

  router.get(
    '/:collection/version/:key/:seq',
    AH(async (req, res, next) => {
      const { key, seq } = req.params
      const timeout = req.query.timeout || WAIT_TIMEOUT
      try {
        const record = await req.collection.getVersion(
          { key, seq },
          { timeout }
        )
        return record.toJSON()
      } catch (err) {
        if (err.code === 'ETIMEDOUT') {
          res.status(404)
          return { error: 'Version not available from peers' }
        } else {
          throw err
        }
      }
    })
  )

  router.get(
    '/:collection/version/:lseq',
    AH(async (req, res, next) => {
      if (!req.params.match(/\d+/)) {
        throw new HttpError(400, 'Invalid lseq')
      }
      const lseq = Number(req.params.lseq)
      const record = await req.collection.getVersion({ lseq })
      return record.toJSON()
    })
  )

  router.get(
    '/:collection/sync',
    AH(async (req, res, next) => {
      let { view = [] } = req.query
      if (typeof view === 'string') view = view.split(',')
      if (!view || view.length === 0) view = null
      await req.collection.sync(view)
      res.end()
    })
  )

  router.post(
    '/:collection/query/:name',
    AH(async (req, res, next) => {
      const name = req.params.name
      const args = req.body
      const opts = req.query || {}
      return req.collection.query(name, args, opts)
    })
  )

  router.get(
    '/:collection/query/:name',
    AH(async (req, res, next) => {
      const name = req.params.name
      const args = req.query
      return req.collection.query(name, args)
    })
  )

  router.get(
    '/:collection/schema',
    AH(async (req, res, next) => {
      if (req.query && req.query.name) {
        const type = req.collection.getType(req.query.name)
        if (!type) return next(HttpError(404, 'Type not found'))
        return type.toJSONSchema()
      } else {
        const types = req.collection.schema.toJSON()
        return types
      }
    })
  )

  router.post(
    '/:collection/schema',
    AH(async (req, res, next) => {
      const spec = req.body
      const collection = req.collection
      try {
        const record = await collection.putType(spec)
        const type = collection.getType(record.value.address)
        if (!type)
          {return next(
            HttpError(404, 'Type not found after put - please report bug')
          )}
        return type.toJSONSchema()
      } catch (err) {
        err.statusCode = 400
        throw err
      }
    })
  )

  router.put(
    '/:collection/feed/:key',
    AH(async (req, res, next) => {
      const { key } = req.params
      const info = req.body
      const record = await req.collection.putFeed(key, info)
      return record.toJSON()
    })
  )

  router.get(
    '/:collection/debug',
    AH(async (req, res, next) => {
      console.log(req.collection)
      return { hello: 'world' }
    })
  )

  router.put(
    '/:collection/subscription/:name',
    AH(async (req, res, next) => {
      const { name } = req.params
      const opts = req.query || {}
      req.collection.subscribe(name, opts)
      res.send({ name })
    })
  )

  router.get(
    '/:collection/subscription/:name',
    AH(async (req, res, next) => {
      const { name } = req.params
      const opts = req.query || {}
      const sub = req.collection.subscribe(name, opts)
      const records = await sub.pull()
      return records
    })
  )

  router.get(
    '/:collection/subscription/:name/sse',
    AH(async (req, res, next) => {
      res.end()
      // const { name } = req.params
      // const opts = req.query || {}
      // opts.live = true

      // const sse = new SSE()
      // sse.init(req, res)

      // const stream = req.collection.pullSubscriptionStream(name, opts)
      // stream.on('data', row => {
      //   sse.send(row, null, row.lseq)
      // })
      // stream.on('error', err => {
      //   sse.send({ error: err.message }, 'error')
      //   res.end()
      // })
      // pump(stream, sse)
    })
  )

  router.post(
    '/:collection/subscription/:name/:cursor',
    AH(async (req, res, next) => {
      const { name, cursor } = req.params
      const opts = req.query || {}
      const sub = req.collection.subscribe(name, opts)
      const records = await sub.ack(cursor)
      return records
    })
  )

  router.get(
    '/:collection/events',
    AH(async (req, res, next) => {
      const eventStream = req.collection.createEventStream({
        lastId: req.header('Last-Event-ID'),
        map: 'sse'
      })
      const sseStream = new SseStream(req)
      eventStream.pipe(sseStream).pipe(res)
      eventStream.on('error', err => {
        // TODO: Can this happen? Log where?
        console.error('event stream error', err)
      })

      res.on('close', () => {
        sseStream.unpipe(res)
        eventStream.destroy()
      })
    })
  )

  router.post(
    '/:collection/reindex',
    AH(async (req, res, next) => {
      let views
      if (req.query.views) {
        views = req.query.views.split(',')
      }

      await req.collection.reindex(views)
      res.send()
    })
  )

  router.post(
    '/:collection/file',
    AH(async function (req, res, next) {
      let metadata = {}
      if (req.query.metadata) {
        try {
          metadata = JSON.parse(req.query.metadata)
          if (typeof metadata !== 'object' || Array.isArray(metadata)) {
            throw new Error('Metadata has to be a JSON object')
          }
        } catch (err) {
          throw new HttpError(400, 'Failed to parse metadata parameter')
        }
      }
      const fileRecord = await req.collection.files.createFile(req, metadata)
      res.send(fileRecord)
    })
  )

  router.get(
    '/:collection/file/:id',
    AH(async function (req, res, next) {
      if (req.query.meta) {
        const record = await req.collection.files.getRecord(req.params.id)
        const json = record.toJSON()
        res.json(json)
        return
      }
      const {
        headers,
        stream,
        statusCode
      } = await req.collection.files.readFileWithHeaders(req.params.id, req)
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value)
      }
      res.status(statusCode)

      pipeline(stream, res, err => {
        if (err) {
          req.collection.log.warn('File request produced error', err)
        }
        res.end()
      })
    })
  )

  return router
}

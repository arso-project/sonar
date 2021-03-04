const SseStream = require('ssestream').default
const express = require('express')
const split2 = require('split2')
const { pipeline } = require('streamx')
const { HttpError } = require('../lib/util')
const AH = require('../lib/async-handler')

const createFsRouter = require('./fs')

module.exports = function createCollectionRoutes (workspace) {
  const router = express.Router()

  router.use('/:collection', AH(async (req, res, next) => {
    const { collection: keyOrName } = req.params
    if (!keyOrName) return next()
    // TODO: Implement auth :-)
    const collection = await workspace.openCollection(keyOrName)
    req.collection = collection
    next()
  }))

  router.use('/:collection/fs', createFsRouter(workspace))

  router.get('/:collection', AH(async (req, res, next) => {
    return req.collection.status()
  }))

  router.patch('/:collection', AH(async (req, res, next) => {
    await req.collection.configure(req.body)
    const config = req.collection.getConfig()
    return config
  }))

  router.put('/:collection/db', AH(async (req, res, next) => {
    let record
    const { batch } = req.query

    if (batch) {
      const batchStream = req.collection.createBatchStream()
      pipeline(req, split2(JSON.parse), batchStream, err => {
        if (err) next(err)
        else res.send({ done: true })
      })
      return
    }

    if (req.params.schema) {
      record = {
        id: req.params.id,
        schema: req.params.schema,
        value: req.body
      }
    } else {
      record = req.body
    }
    const createdRecord = await req.collection.put(record)
    return createdRecord.toJSON()
  }))

  router.delete('/:collection/db/:id', AH(async (req, res, next) => {
    const { id } = req.params
    const { type } = req.query
    await req.collection.del({ id, type })
    return { id, type, deleted: true }
  }))

  router.get('/:collection/db/:key/:seq', AH(async (req, res, next) => {
    const { key, seq } = req.params
    const record = await req.collection.getBlock({ key, seq })
    return record.toJSON()
  }))

  router.get('/:collection/sync', AH(async (req, res, next) => {
    let { view = [] } = req.query
    if (typeof view === 'string') view = view.split(',')
    if (!view || view.length === 0) view = null
    await req.collection.sync(view)
    res.end()
  }))

  router.post('/:collection/query/:name', AH(async (req, res, next) => {
    const name = req.params.name
    const args = req.body
    const opts = req.query || {}
    return req.collection.query(name, args, opts)
  }))

  router.get('/:collection/schema', AH(async (req, res, next) => {
    if (req.query && req.query.name) {
      const type = req.collection.getType(req.query.name)
      if (!type) return next(HttpError(404, 'Type not found'))
      return type.toJSONSchema()
    } else {
      const types = req.collection.schema.toJSON()
      return types
    }
  }))

  router.post('/:collection/schema', AH(async (req, res, next) => {
    const spec = req.body
    const collection = req.collection
    try {
      const record = await collection.putType(spec)
      const type = collection.getType(record.value.address)
      if (!type) return next(HttpError(404, 'Type not found after put - please report bug'))
      return type.toJSONSchema()
    } catch (err) {
      err.statusCode = 400
      throw err
    }
  }))

  router.put('/:collection/feed/:key', AH(async (req, res, next) => {
    const { key } = req.params
    const info = req.body
    const record = await req.collection.putFeed(key, info)
    return record.toJSON()
  }))

  router.get('/:collection/debug', AH(async (req, res, next) => {
    return { hello: 'world' }
  }))

  router.put('/:collection/subscription/:name', AH(async (req, res, next) => {
    const { name } = req.params
    const opts = req.query || {}
    req.collection.subscribe(name, opts)
    res.send({ name })
  }))

  router.get('/:collection/subscription/:name', AH(async (req, res, next) => {
    const { name } = req.params
    const opts = req.query || {}
    const sub = req.collections.subscribe(name, opts)
    const records = await sub.pull()
    return records
  }))

  router.get('/:collection/subscription/:name/sse', AH(async (req, res, next) => {
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
  }))

  router.post('/:collection/subscription/:name/:cursor', AH(async (req, res, next) => {
    const { name, cursor } = req.params
    const opts = req.query || {}
    const sub = req.collections.subscribe(name, opts)
    const records = await sub.ack(cursor)
    return records
  }))

  router.get('/:collection/events', AH(async (req, res, next) => {
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
  }))

  router.post('/:collection/reindex', AH(async (req, res, next) => {
    let views
    if (req.query.views) {
      views = req.query.views.split(',')
    }

    await req.collection.reindex(views)
    res.send()
  }))

  router.get('/:collection/fs-info', AH(async function (req, res, next) {
    const { collection } = req
    const records = await collection.query('records', { type: 'sonar/feed' })
    const drives = records
      .filter(record => record.value.type === 'hyperdrive')
      .map(record => record.value)
    let pending = drives.length
    if (!drives.length) return res.send([])
    drives.forEach(driveInfo => {
      collection.fs.get(driveInfo.key, (err, drive) => {
        if (err) driveInfo.error = err.message
        else {
          driveInfo.writable = drive.writable
        }
        if (--pending === 0) res.send(drives)
      })
    })
  }))

  return router
}

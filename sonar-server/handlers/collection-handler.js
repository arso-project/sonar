const SseStream = require('ssestream').default
const { HttpError } = require('../lib/util')

module.exports = function createCollectionHandler (collections) {
  return {
    status (req, res, next) {
      req.collection.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
    },
    put (req, res, next) {
      let record
      if (req.params.schema) {
        record = {
          id: req.params.id,
          schema: req.params.schema,
          value: req.body
        }
      } else {
        record = req.body
      }
      req.collection.put(record, (err, record) => {
        if (err) return next(err)
        res.send(record.toJSON())
      })
    },

    del (req, res, next) {
      const { id } = req.params
      const { type } = req.query
      req.collection.del({ id, type }, (err, result) => {
        if (err) return next(err)
        res.send({ id, type, deleted: true })
      })
    },

    get (req, res, next) {
      const { key, seq } = req.params
      req.collection.loadRecord({ key, seq }, (err, record) => {
        if (err) return next(err)
        res.send(record)
      })
    },

    sync (req, res, next) {
      let { view = [] } = req.query
      if (typeof view === 'string') view = view.split(',')
      if (!view || view.length === 0) view = null
      // TODO: Rethink the timeout logic?
      // let done = false
      // setTimeout(() => {
      //   if (done) return
      //   done = true
      //   next(new Error('Sync timeout'))
      // }, SYNC_TIMEOUT)
      req.collection.sync(view, (err) => {
        // if (done) return
        // done = true
        if (err) return next(err)
        res.end()
      })
    },

    // TODO: This should be something different than get
    // and intead drive different kinds of queries.
    query (req, res, next) {
      const name = req.params.name
      const args = req.body
      const opts = req.query || {}
      req.collection.query(name, args, opts, (err, records) => {
        if (err) return next(err)
        res.send(records)
      })
    },

    getTypes (req, res, next) {
      if (req.query && req.query.name) {
        const type = req.collection.getType(req.query.name)
        if (!type) return next(HttpError(404, 'Type not found'))
        else res.send(type.toJSONSchema())
      } else {
        const types = req.collection.serializeSchema()
        res.send(types)
      }
    },

    putType (req, res, next) {
      const spec = req.body
      const collection = req.collection
      collection.putType(spec, (err, record) => {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
        const type = collection.getType(record.value.address)
        if (!type) return next(HttpError(404, 'Type not found after put - please report bug'))
        res.send(type.toJSONSchema())
      })
    },

    putFeed (req, res, next) {
      const { key } = req.params
      const info = req.body
      req.collection.putFeed(key, info, (err) => {
        if (err) return next(err)
        return res.send({ msg: 'ok' })
      })
    },

    debug (req, res, next) {
      req.collection.db.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
      // res.send(req.collection.status())
    },

    createSubscription (req, res, next) {
      const { name } = req.params
      const opts = req.query || {}
      req.collection.createSubscription(name, opts)
      res.send({ name })
    },

    pullSubscription (req, res, next) {
      const { name } = req.params
      const opts = req.query || {}
      req.collection.pullSubscription(name, opts, (err, result) => {
        if (err) return next(err)
        res.send(result)
      })
    },

    pullSubscriptionSSE (req, res, next) {
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
    },

    ackSubscription (req, res, next) {
      const { name, cursor } = req.params
      req.collection.createSubscription(name)
      req.collection.ackSubscription(name, cursor, (err, result) => {
        if (err) return next(err)
        res.send(result)
      })
    },

    eventsSSE (req, res, next) {
      const eventStream = req.collection.createEventStream({
        lastId: req.header('Last-Event-ID'),
        map: 'sse'
      })
      const sseStream = new SseStream(req)
      eventStream.pipe(sseStream).pipe(res)

      res.on('close', () => {
        sseStream.unpipe(res)
        eventStream.destroy()
      })
    },

    reindex (req, res, next) {
      let views
      if (req.query.views) {
        views = req.query.views.split(',')
      }

      req.collection.reindex(views, (err) => {
        if (err) return next(err)
        res.send()
      })
    }
  }
}

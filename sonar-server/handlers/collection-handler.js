const SSE = require('express-sse')

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
      req.collection.put(record, (err, id) => {
        if (err) return next(err)
        res.send({ id })
      })
    },

    del (req, res, next) {
      const { id } = req.params
      const { schema } = req.query
      req.collection.del({ id, schema }, (err, result) => {
        if (err) return next(err)
        res.send({ id, schema, deleted: true })
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
      req.collection.scope.sync(view, (err) => {
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

    getSchemas (req, res, next) {
      if (req.query && req.query.name) {
        const schema = req.collection.getSchema(req.query.name)
        if (!schema) return next(HttpError(404, 'Schema not found'))
        else res.send(schema)
      } else {
        const schemas = req.collection.getSchemas()
        res.send(schemas)
      }
    },

    putSchema (req, res, next) {
      const schema = req.body
      const name = schema.name
      const collection = req.collection
      collection.putSchema(name, schema, (err, id) => {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
        collection.getSchema(id, (err, result) => {
          if (err) return next(err)
          res.send(result)
        })
      })
    },

    putSource (req, res, next) {
      const { key } = req.params
      const info = req.body
      req.collection.putSource(key, info, (err) => {
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
      const { name } = req.params
      const opts = req.query || {}
      opts.live = true

      const sse = new SSE()
      sse.init(req, res)

      const stream = req.collection.pullSubscriptionStream(name, opts)
      stream.on('data', row => {
        sse.send(row, null, row.lseq)
      })
      stream.on('error', err => {
        sse.send({ error: err.message }, 'error')
        res.end()
      })
      // pump(stream, sse)
    },

    ackSubscription (req, res, next) {
      const { name, cursor } = req.params
      req.collection.createSubscription(name)
      req.collection.ackSubscription(name, cursor, (err, result) => {
        if (err) return next(err)
        res.send(result)
      })
    }
  }
}

function HttpError (code, message) {
  let err
  if (message instanceof Error) err = message
  else err = new Error(message)
  err.statusCode = code
  return err
}

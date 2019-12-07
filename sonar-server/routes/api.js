const { hyperdriveHandler } = require('./hyperdrive')
const collect = require('collect-stream')
const { Router } = require('simple-rpc-protocol')

module.exports = function apiRoutes (fastify, opts, done) {
  const handlers = createApiHandlers(opts.islands)

  // Info
  fastify.get('/_info', handlers.info)
  // Create island
  fastify.put('/_create/:name', handlers.createIsland)
  // Create record
  fastify.post('/:key/db/:schemans/:schemaname', handlers.put)
  // Update record
  fastify.put('/:key/db/:schemans/:schemaname/:id', handlers.put)
  // Get record
  fastify.get('/:key/db/:id', handlers.get)
  fastify.get('/:key/db/:schemans/:schemaname/:id', handlers.get)
  // Search/Query
  fastify.post('/:key/_search', handlers.search)
  fastify.post('/:key/_query', handlers.query)
  // Get schema
  fastify.get('/:key/schema/:schemans/:schemaname', handlers.getSchema)
  // Put schema
  fastify.put('/:key/schema/:schemans/:schemaname', handlers.putSchema)

  // Get files
  fastify.get('/:key/fs', handlers.files)
  fastify.get('/:key/fs/*', handlers.files)
  // Put files.
  fastify.put('/:key/fs/*', handlers.files)

  // Add source
  fastify.put('/:key/_source', handlers.putSource)

  fastify.get('/:key/commands', { websocket: true }, createCommandHandler(opts.islands))

  // TODO: Create record with id / Replace record
  // TODO: Batch insertion of records

  done()
}

function createCommandHandler (islands) {
  const router = new Router({ name: 'server' })
  return function createCommandStream (socket, req, params) {
    const { key } = params
    socket.on('error', err => {
      console.error('command socket error', err)
    })
    router.connection(socket)
  }
}

function createApiHandlers (islands) {
  return {
    info (req, res) {
      islands.list((err, islands) => {
        if (err) return res.code(500).send({ error: 'Could not fetch info' })
        res.send({ islands })
      })
    },
    createIsland (req, res) {
      const { name } = req.params
      islands.create(name, (err, island) => {
        if (err) return res.code(500).send({ error: 'Could not create island' })
        res.send({
          key: island.key.toString('hex')
        })
      })
    },

    put (req, res) {
      console.log('HERE', req.params)
      const { key, id } = req.params
      const value = req.body

      islands.get(key, (err, island) => {
        if (err) return res.code(404).send({ error: 'Island not found' })
        const schema = expandSchema(island, req.params)
        island.put({ schema, id, value }, (err, id) => {
          if (err) return res.code(500).send({ error: 'Could not create record' })
          res.send({ id })
        })
      })
    },

    get (req, res) {
      let { key, id } = req.params
      // if (schema) schema = decodeURIComponent(schema)
      // if (id) id = decodeURIComponent(id)
      islands.get(key, (err, island) => {
        if (err) return res.code(404).send({ error: 'Island not found' })
        const schema = expandSchema(island, req.params)

        // TODO: This uses two different APIs, which is of course not right.
        // With schema and id, it uses HyperContentDB.get(), which looks
        // up records by filepath. Without schema, it uses entities view's
        // allWithId method, which is not only badly named but also should
        // just expose a .get method. It's also faster so that should be
        // used. Has to be fixed in hyper-content-db.
        if (schema) {
          island.get({ schema, id }, (err, record) => {
            if (err) return res.code(404).send()
            res.send(record)
          })
        } else {
          const queryStream = island.api.entities.byId(id)
          const getStream = island.createGetStream()
          const resultStream = queryStream.pipe(getStream)
          collect(resultStream, (err, results) => {
            if (err) return res.code(404).send()
            res.send(results)
          })
        }
      })
    },

    query (req, res) {
      const key = req.params.key
      const { schema, id, source } = req.body
      islands.get(key, (err, island) => {
        if (err) {
          res.code(500).send({ error: 'Could not open island', key: key })
        }
        const queryStream = island.api.entities.get({ schema, id, source })
        const getStream = island.createGetStream()
        const resultStream = queryStream.pipe(getStream)
        collect(resultStream, (err, results) => {
          if (err) return res.code(404).send()
          res.send(results)
        })
      })
    },

    getSchema (req, res) {
      const { key } = req.params
      islands.get(key, (err, island) => {
        if (err) return res.code(500).send({ error: 'Could not open island', key: key })
        let schema = expandSchema(island, req.params)
        island.getSchema(schema, (err, schemaValue) => {
          if (err) return res.code(404).send({ error_code: 404 })
          res.send(schemaValue)
        })
      })
    },

    putSchema (req, res) {
      let { key } = req.params
      islands.get(key, (err, island) => {
        let schema = expandSchema(island, req.params)
        if (err) {
          res.code(500).send({ error: 'Could not put schema', key })
        } else {
          island.putSchema(schema, req.body, (err) => {
            if (err) return res.code(400).send({ error_code: 400 })
            island.getSchema(schema, (err, result) => {
              res.send({ schema })
            })
          })
        }
      })
    },

    putSource (req, res) {
      const { key } = req.params
      const { key: sourceKey } = req.body
      islands.get(key, (err, island) => {
        if (err) return res.code(404).send({ error: 'Island not found', key: key })
        island.addSource(sourceKey, (err) => {
          if (err) return res.code(500).send({ error: err.message })
          return res.send({ msg: 'Source added' })
        })
      })
    },

    files (req, res) {
      let { key, '*': path } = req.params
      path = path || ''
      hyperdriveHandler(islands, key, path, req, res)
    },

    search (req, res) {
      const { key, schema } = req.params
      const query = req.body

      islands.get(key, (err, island) => {
        if (err) return res.code(500).send({ error: 'Could not open island', key: key })
        // Query can either be a string (tantivy query) or an object (toshi json query)
        const resultStream = island.api.search.query(query)
        replyStream(res, resultStream)
      })
    },

  }
}

function expandSchema (island, { schemans, schemaname }) {
  if (!schemans || !schemaname) return null
  if (schemans === '_') schemans = island.key.toString('hex')
  const schema = schemans + '/' + schemaname
  return schema
}

function replyStream(res, stream) {
  const results = []
  let error = false
  stream.on('data', data => results.push(data))
  stream.on('error', err => (error = err))
  stream.on('close', () => {
    if (error) res.code(422).send({ error })
  })
  stream.on('end', () => {
    res.send(results)
  })
}

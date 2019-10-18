const { hyperdriveHandler } = require('./hyperdrive')
const collect = require('collect-stream')

module.exports = function apiRoutes (fastify, opts, done) {
  const handlers = createApiHandlers(opts.islands)

  // Create island
  fastify.put('/_create/:name', handlers.createIsland)
  // Create record
  fastify.post('/:key/:schema', handlers.put)
  // Update record
  fastify.put('/:key/:schema/:id', handlers.put)
  // Get record
  fastify.get('/:key/:id', handlers.get)
  fastify.get('/:key/:schema/:id', handlers.get)
  // Search/Query
  fastify.post('/:key/_search', handlers.search)
  // Get schema
  fastify.get('/:key/:schema/_schema', handlers.getSchema)
  // Put schema
  fastify.put('/:key/:schema/_schema', handlers.putSchema)

  // Get files
  fastify.get('/:key/files', handlers.files)
  fastify.get('/:key/files/*', handlers.files)

  // TODO: Create record with id / Replace record
  // TODO: Batch insertion of records

  done()
}

function createApiHandlers (islands) {
  return {
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
      const { key, schema, id } = req.params
      const value = req.body

      islands.get(key, (err, island) => {
        if (err) return res.code(404).send({ error: 'Island not found' })
        island.put({ schema, id, value }, (err, id) => {
          if (err) return res.code(500).send({ error: 'Could not create record' })
          res.send({ id })
        })
      })
    },

    get (req, res) {
      const { key, schema, id } = req.params
      islands.get(key, (err, island) => {
        if (err) return res.code(404).send({ error: 'Island not found' })

        // TODO: This uses two different APIs, which is of course not right.
        // With schema and id, it uses HyperContentDB.get(), which looks
        // up records by filepath. Without schema, it uses entities view's
        // allWithId method, which is not only badly named but also should
        // just expose a .get method. It's also faster so that should be
        // used. Has to be fixed in hyper-content-db.
        if (schema) {
          island.get({ schema, id }, (err, record) => {
            res.send(record)
          })
        } else {
          const queryStream = island.api.entities.allWithId({ id })
          const getStream = island.createGetStream()
          const resultStream = queryStream.pipe(getStream)
          collect(resultStream, (err, results) => {
            if (err) return res.code(404).send()
            res.send(results)
          })
        }
      })
    },

    getSchema (req, res) {
      const key = req.params.key
      const schema = req.params.schema
      islands.get(key, (err, island) => {
        if (err) {
          res.code(500).send({ error: 'Could not open island', key: key })
        } else {
          island.getSchema(schema, (err, schemaValue) => {
            if (err) return res.code(404).send({ error_code: 404 })
            res.send(schemaValue)
          })
        }
      })
    },

    putSchema (req, res) {
      const { key, schema } = req.params
      islands.get(key, (err, island) => {
        if (err) {
          res.code(500).send({ error: 'Could not put schema', key })
        } else {
          island.putSchema(schema, req.body, (err) => {
            if (err) return res.code(400).send({ error_code: 400 })
            res.send({ msg: 'Schema set' })
          })
        }
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
    }
  }
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

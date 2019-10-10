module.exports = function apiRoutes (fastify, opts, done) {
  const handlers = createApiHandlers(opts.islands)

  // Create island
  fastify.put('/_create/:name', handlers.createIsland)
  // Create record
  fastify.post('/:key/:schema', handlers.put)
  // Update record
  fastify.put('/:key/:schema/:id', handlers.put)
  // Get record
  fastify.get('/:key/:schema/:id', handlers.get)
  // Search/Query
  fastify.post('/:key/_search', handlers.search)
  // Get schema
  fastify.get('/:key/:schema/_schema', handlers.getSchema)
  // Put schema
  fastify.put('/:key/:schema/_schema', handlers.putSchema)

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
        island.get({ key, schema, id }, (err, record) => {
          if (err) return res.code(404).send()
          res.send(record)
        })
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

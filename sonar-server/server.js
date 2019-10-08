const { openIsland, IslandManager } = require('../sonar-dat')

if (require.main === module) {
  const opts = extractOptions()
  const server = makeServer(opts)
  console.log(opts)
  server.start()
} else {
  module.exports = makeServer
}

function makeServer (opts) {
  const fastify = require('fastify')({ logger: true })
  const dir = '../.data'
  const islands = new IslandManager(dir)

  // Create island
  fastify.put('/_create/:name', (req, res) => {
    const name = req.params.name
    islands.openByName(name, (err, island) => {
      if (err) {
        res.send({ error: 'Could not create island' })
      } else {
        res.send({ msg: 'Island with name ' + name + ' created!', key: island.key.toString('hex') })
      }
    })
  })

  fastify.post('/:key/:schema', (req, res) => {
    const key = req.params.key
    const schema = req.params.schema
    islands.openByKey(key, (err, island) => {
      if (err) {
        res.erro({ error: 'Could not open island', key: key })
      } else {
        island.put({ schema: schema, value: req.body }, (err, id) => {
          if (err) {
            res.error({ error: 'Could not create record' })
          } else {
            res.send({ msg: 'Created record', id: id })
          }
        })
      }
    })
  })

  // TODO: Create record with id / Replace record
  fastify.put('/:key/:schema', (req, res) => {
  })

  // Get record
  fastify.get('/:key/:schema/:id', (req, res) => {
    const key = req.params.key
    const schema = req.params.schema
    const id = req.params.id
    islands.openByKey(key, (err, island) => {
      if (err) {
        res.erro({ error: 'Could not open island', key: key })
      } else {
        island.get({ schema: schema, id: id }, (err, record) => {
          if (err) return res.error({ error_code: 404 })
          res.send(record)
        })
      }
    })
  })

  // TODO: Search/query
  fastify.get('/:key/:schema/_search', (req, res) => {
  })

  // TODO: Batch insertion of records

  // TODO: Get schema

  function start () {
    fastify.listen(opts.port || 9191, 'localhost', (err) => {
      if (err) return console.error(err)
    })
  }

  return {
    fastify, start
  }
}

function extractOptions () {
  const argv = require('minimist')(process.argv.slice(2), {
    alias: {
      p: 'port',
      s: 'storage',
      k: 'key'
    }
  })

  console.log(argv)

  const opts = {
    port: argv.port || 9191,
    storage: argv.storage || './data',
    key: argv.key || null
  }

  return opts
}

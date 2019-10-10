const tape = require('tape')
const tmp = require('temporary-directory')
const { stepper } = require('./lib/util')

const { IslandManager } = require('..')
const { makeTantivySchema, mergeSchemas, addSchemaProperty } = require('../lib/search/schema')
const getExampleSchemas = require('../lib/search/example_schemas')

tape('basic', t => {
  tmp((err, dir, cleanup) => {
    t.error(err, 'tempdir ok')
    const islands = new IslandManager(dir)

    islands.create('first', (err, island) => {
      t.error(err, 'island created')

      const step = stepper(finish)

      const records = [
        { title: 'Hello world', body: 'so rough' },
        { title: 'Hello moon', body: 'so dark' }
      ]

      const batch = records.map(value => ({ op: 'put', schema: 'doc', value }))
      island.batch(batch, err => {
        t.error(err, 'batch ok')
      })

      // TODO: Don't rely on timeouts.
      setTimeout(() => {
      // island.on('indexed-all', () => {
        step((cb) => {
          query(island, 'hello', (err, res) => {
            console.log(res)
            t.equal(res.length, 2)
            cb(err)
          })
        })
        step((cb) => {
          query(island, 'moon', (err, res) => {
            t.equal(res.length, 1)
            cb(err)
          })
        })
      }, 1000)

      function finish (err) {
        t.error(err, 'finish ok')
        island.api.search.close()
        cleanup((err) => {
          t.ifError(err)
          t.end()
        })
      }
    })
  })
})

tape('schema_merge', t => {
  tmp((err, dir, cleanup) => {
    t.error(err, 'tempdir ok')
    const schemas = getExampleSchemas()

    const fullSchema = mergeSchemas(schemas)

    t.equal(Array.isArray(fullSchema), true)
    fullSchema.forEach(e => {
      t.deepEqual(Object.keys(e), ['name', 'type', 'options'])
      t.equal(e.name.split(':').length, 2)
    })
    t.end()
  })
})

tape('schema_addProperty', t => {
  tmp((err, dir, cleanup) => {
    t.error(err, 'tempdir ok')
    const schema = getExampleSchemas()[0]
    
    const property = {
      title: 'foo',
      type: 'string',
      format :'date-time',
      erny: 'bert',
      favAnimal: 'Bee'
    }
    
    addSchemaProperty(schema, property)

    let { title, ...testProp } = property

    t.deepEqual(testProp, schema.properties.foo)
    t.end()
  })
})

function query (island, query, cb) {
  const results = []
  const rs = island.api.search.query(query)
  rs.on('data', row => {
    results.push(row)
  })
  rs.on('error', err => cb(err))
  rs.on('end', () => {
    cb(null, results)
  })
}

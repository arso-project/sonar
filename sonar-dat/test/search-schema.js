const tape = require('tape')
const { makeTantivySchema, mergeSchemas, addSchemaProperty } = require('../lib/search/schema')
const getExampleSchemas = require('./lib/example-schemas')

tape('schema merge', t => {
  const schemas = getExampleSchemas()

  const fullSchema = mergeSchemas(schemas)

  t.equal(Array.isArray(fullSchema), true)
  fullSchema.forEach(e => {
    t.deepEqual(Object.keys(e), ['name', 'type', 'options'])
    t.equal(e.name.split(':').length, 2)
  })
  t.end()
})

tape('schema addProperty', t => {
  const schema = getExampleSchemas()[0]

  const property = {
    title: 'foo',
    type: 'string',
    format: 'date-time',
    erny: 'bert',
    favAnimal: 'Bee'
  }

  addSchemaProperty(schema, property)

  let { title, ...testProp } = property

  t.deepEqual(testProp, schema.properties.foo)
  t.end()
})

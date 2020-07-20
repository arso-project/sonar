module.exports = {
  getTextdumpSchema,
  makeTantivySchema,
  mergeSchemas,
  addSchemaProperty
}

function getTextdumpSchema () {
  const schema = [
    {
      name: 'title',
      type: 'text',
      options: {
        indexing: {
          record: 'position',
          tokenizer: 'en_stem'
        },
        stored: true
      }
    },
    {
      name: 'body',
      type: 'text',
      options: {
        indexing: {
          record: 'position',
          tokenizer: 'en_stem'
        },
        stored: true
      }
    },
    ...commonFields()
  ]
  return schema
}

// Property: Object
// with at least the following parameters:
// title, type
// optionally:
// format, maxLength

function addSchemaProperty (schema, property) {
  const { title, ...rest } = property
  if (!title || !rest.type) throw new Error('title and type expected')
  if (!schema.properties) schema.properties = {}

  schema.properties[title] = rest
//  return schema
}

function mergeSchemas (schemas) {
  if (!Array.isArray(schemas)) throw new Error('Expecting Array')

  const tschemas = []

  schemas.forEach(s => {
    tschemas.push(...makeTantivySchema(s, { doPrefix: true }))
  })

  return tschemas
}

function makeTantivySchema (schema, opts = {}) {
  let prefix = ''
  if (opts.doPrefix) {
    prefix = schema.title + ':'
  }
  const tschema = []
  if (schema.properties) {
    for (const [name, prop] of Object.entries(schema.properties)) {
      if (prop.type === 'string') {
        tschema.push({
          name: prefix + name,
          type: 'text',
          options: {
            indexing: {
              record: 'position',
              tokenizer: 'en_stem'
            },
            stored: true
          }
        })
      }
      if (prop.type === 'date') {
        tschema.push({
          name: prefix + name,
          type: 'date',
          options: {
            indexed: true,
            fast: 'multi',
            stored: true
          }
        })
      }
    }
  }

  return [...tschema, ...commonFields(prefix)]
}

function commonFields (prefix) {
  if (!prefix) prefix = ''

  return [
    {
      name: prefix + 'id',
      type: 'text',
      options: {
        indexing: {
          record: 'basic',
          tokenizer: 'default'
        },
        stored: true
      }
    },
    {
      name: prefix + 'source',
      type: 'text',
      options: {
        indexing: {
          record: 'basic',
          tokenizer: 'default'
        },
        stored: true
      }
    },
    {
      name: prefix + 'seq',
      // type: 'u64',
      // options: {
      //   indexed: true,
      //   fast: 'single',
      //   stored: true
      // }
      // TODO: Use integer!
      type: 'text',
      options: {
        indexing: {
          record: 'basic',
          tokenizer: 'default'
        },
        stored: true
      }
    },
    {
      name: prefix + 'type',
      type: 'text',
      options: {
        indexing: {
          record: 'basic',
          tokenizer: 'default'
        },
        stored: true
      }
    }
  ]
}

// const jsonSchemaGenerator = require('json-schema-generator')
// function deriveSchema (record) {
//   const { schema: schemaName, id, value } = record
//   const schema = jsonSchemaGenerator(value)
//   return schema
// }

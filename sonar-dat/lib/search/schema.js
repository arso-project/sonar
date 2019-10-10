module.exports = {
  getTextdumpSchema,
  makeTantivySchema,
  mergeSchemas
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
      name: prefix + 'schema',
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

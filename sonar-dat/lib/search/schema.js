module.exports = {
  getTextdumpSchema,
  makeTantivySchema
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

function makeTantivySchema (schema) {
  const tschema = []
  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'string') {
      tschema.push({
        name: name,
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
        name: name,
        type: 'date',
        options: {
          indexed: true,
          fast: 'multi',
          stored: true
        }
      })
    }
  }

  return [...tschema, ...commonFields()]
}

function commonFields () {
  return [
    {
      name: 'id',
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
      name: 'source',
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
      name: 'schema',
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

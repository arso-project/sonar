const SCHEMA_SCHEMA = {
  $id: 'core/schema',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      index: true
    }
  }
}

const SOURCE_SCHEMA = {
  $id: 'core/source',
  type: 'object',
  properties: {
    type: { type: 'string', title: 'Type' },
    key: { type: 'string', pattern: '^[0-9a-f]{64}$', title: 'key' },
    alias: { type: 'string', title: 'Alias' },
    description: { type: 'string', title: 'Description' }
  }
}

const ANY_SCHEMA = {
  $id: 'core/any', type: 'object'
}

module.exports = [
  SCHEMA_SCHEMA, SOURCE_SCHEMA, ANY_SCHEMA
]

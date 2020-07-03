const SCHEMA_SCHEMA = {
  namespace: 'core',
  name: 'schema',
  fields: {
    name: {
      type: 'string',
      index: {
        basic: true,
        search: { mode: 'field' }
      }
    }
  }
}

const SOURCE_SCHEMA = {
  namespace: 'core',
  name: 'source',
  fields: {
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

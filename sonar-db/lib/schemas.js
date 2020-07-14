const TYPE = {
  namespace: 'sonar',
  name: 'type',
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

const FEED = {
  namespace: 'sonar',
  name: 'feed',
  fields: {
    type: { type: 'string', title: 'Type' },
    key: { type: 'string', pattern: '^[0-9a-f]{64}$', title: 'key' },
    alias: { type: 'string', title: 'Alias' },
    parent: { type: 'relation', title: 'Parent' },
    description: { type: 'string', title: 'Description' }
  }
}

// const ANY_SCHEMA = {
//   $id: 'core/any', type: 'object'
// }

module.exports = { TYPE, FEED }

const tape = require('tape')
const { createOne } = require('@arsonar/core/test/lib/create')

tape('relations', async t => {
  const { workspace, cleanup } = await createOne()
  const type = {
    name: 'friend',
    fields: {
      name: {
        type: 'string'
      },
      friends: {
        type: 'relation',
        multiple: true
      }
    }
  }

  const collection = await workspace.createCollection('default')
  await collection.putType(type)
  await collection.put({
    id: 'alice',
    type: 'friend',
    value: { name: 'Alice', friends: ['bob'] }
  })
  await collection.put({
    id: 'bob',
    type: 'friend',
    value: { name: 'Bob', friends: ['alice', 'claire'] }
  })
  await collection.put({
    id: 'claire',
    type: 'friend',
    value: { name: 'Claire', friends: ['bob'] }
  })
  await collection.sync()

  const friendType = collection.getType('friend')
  const query = {
    object: 'bob',
    predicate: friendType.name + '#' + 'friends'
  }

  const results = await collection.query('relations', query)
  t.deepEqual(results.map(r => r.id).sort(), ['alice', 'claire'])
  await cleanup()
})

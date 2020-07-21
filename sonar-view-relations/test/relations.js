const tape = require('tape')
const { runAll } = require('@arso-project/sonar-core/test/lib/util')
const createStore = require('@arso-project/sonar-core/test/lib/create')

tape('relations', t => {
  createStore({ network: false }, (err, collections, cleanup) => {
    t.error(err, 'tempdir ok')
    const type = {
      name: 'friend',
      fields: {
        name: {
          type: 'string'
        },
        friends: {
          type: 'relation',
          multiple: true
          // type: 'array',
          // index: { relation: true },
          // items: { type: 'string' }
        }
      }
    }

    let collection
    runAll([
      next => collections.create('default', (err, _collection) => {
        if (err) return t.fail(err)
        collection = _collection
        next()
      }),
      next => collection.putType(type, next),
      next => collection.put({
        id: 'alice',
        type: 'friend',
        value: { name: 'Alice', friends: ['bob'] }
      }, next),
      next => collection.put({
        id: 'bob',
        type: 'friend',
        value: { name: 'Bob', friends: ['alice', 'claire'] }
      }, next),
      next => collection.put({
        id: 'claire',
        type: 'friend',
        value: { name: 'Claire', friends: ['bob'] }
      }, next),
      next => collection.scope.sync(next),
      next => {
        const type = collection.getType('friend')
        const query = {
          object: 'bob',
          predicate: type.name + '#' + 'friends'
        }
        collection.query('relations', query, (err, results) => {
          t.error(err)
          t.deepEqual(results.map(r => r.id).sort(), ['alice', 'claire'])
          next()
        })
      },
      next => cleanup(next)
    ]).catch(err => t.fail(err)).then(() => t.end())
  })
})

# @arsonar/core

A battery-including kappa database for hypercores.

### Features

* Create and clone collections
* Add feeds to collections (using hypercores)
* Add data types (models) to collections
* Add data records to feeds
* Replicate collections between peers
* File system per collection (using hyperdrives)
* Full-text search
* Pluggable query backends
* Remote queries (into the peer to peer swarm)

## Example

```javascript
const { Workspace } = require('@arsonar/workspace')

const workspace = new Workspace('/tmp/database')
const collection = await workspace.get('my-db')

// Create a type.
await collection.putType({ 
  name: 'doc',
  fields: { title: { type: 'string' } }
})

// Put json records.
await collection.put({ type: 'doc', value: { title: 'Hello, world!' })

// Make a query.
const results = await collection.query('search', 'hello', { sync: true })
console.log(results)

```

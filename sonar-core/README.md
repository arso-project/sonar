# sonar-core

The core. Manages *groups*, where each group is a [kappa-record-db](https://github.com/arso-project/kappa-record-db)and associated hyperdrives.

* Adds a full-text search engine to a kappa-record-db (through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy)
* Adds a simple file system per group (as [hyperdrives](https://github.com/mafintosh/hyperdrive)
* Includes an `GroupStore` to manage several groups
* Includes a networking module to share groups over [hyperswarm](https://github.com/hyperswarm/hyperswarm)

## Example

```javascript
const { GroupStore } = require('sonar-core')

const store = new GroupStore('/tmp/database')

store.create('my-db', (err, group) => {
  // Create a schema.
  group.putSchema('doc', { 
    properties: { title: { type: 'string' } }
  })

  // Put json records.
  group.put({ schema: 'doc', value: { title: 'Hello!' })

  // Make a query.
  group.query('search', 'hello')
})

```

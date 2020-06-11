# sonar-core

The core. Manages *collections*, where each collection is a [kappa-record-db](https://github.com/arso-project/kappa-record-db) and associated hyperdrives.

* Adds a full-text search engine to a kappa-record-db (through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy))
* Adds a simple file system per collection (as [hyperdrives](https://github.com/mafintosh/hyperdrive))
* Includes an `CollectionStore` to manage collections
* Includes a networking module to share collections over [hyperswarm](https://github.com/hyperswarm/hyperswarm)

## Example

```javascript
const { CollectionStore } = require('sonar-core')

const store = new CollectionStore('/tmp/database')

store.create('my-db', (err, collection) => {
  // Create a schema.
  collection.putSchema('doc', { 
    properties: { title: { type: 'string' } }
  })

  // Put json records.
  collection.put({ schema: 'doc', value: { title: 'Hello!' })

  // Make a query.
  collection.query('search', 'hello', (err, results) => 7
    console.log(results)
  })
})

```

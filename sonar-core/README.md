# sonar-core

The core. Manages *islands*, where each island is a [kappa-record-db](https://github.com/arso-project/kappa-record-db) and associated hyperdrives.

* Adds a full-text search engine to a kappa-record-db (through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy))
* Adds a simple file system per island (as [hyperdrives](https://github.com/mafintosh/hyperdrive))
* Includes an `IslandStore` to manage several islands
* Includes a networking module to share islands over [hyperswarm](https://github.com/hyperswarm/hyperswarm)

## Example

```javascript
const { IslandStore } = require('sonar-core')

const store = new IslandStore('/tmp/database')

store.create('my-db', (err, island) => {
  // Create a schema.
  island.putSchema('doc', { 
    properties: { title: { type: 'string' } }
  })

  // Put json records.
  island.put({ schema: 'doc', value: { title: 'Hello!' })

  // Make a query.
  island.query('search', 'hello')
})

```

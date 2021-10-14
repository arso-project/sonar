# @arsonar/client

A JavaScript client for Sonar for browsers and Node.js.

The client talks to [`@arsonar/server`](../server/README.md) over HTTP.

### Usage

`npm install @arsonar/client`

```javascript
const { Workspace } = require('@arsonar/client')
```
or

```javascript
import { Workspace } from '@arsonar/client'
```

### Example

```javascript
const { Workspace } = require('@arsonar/client')
const url = 'http://localhost:9191/api/v1/default'
const workspace = new Workspace({ url })

const collection = await workspace.createCollection('foobar')
await collection.put({
  type: 'sonar/entity',
  value: { label: 'hello world' }
})
const records = await collection.query('records', { type: 'sonar/entity' })
console.log(records)
```

### API

See [api.md](api.md) for the API docs.


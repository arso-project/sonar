---
id: api-client
title: Client
---
## Intro

The primary way to interact with Sonar is through the *Sonar Client*. The Client talks to the Sonar daemon over HTTP. The Sonar daemon is part of the P2P network, exchanges data with other peers and indexes the data in your islands.

## Get started

The client works both in browsers and in NodeJS. When using in browser, you currently need to have a bundling setup that supports CommonJS (e.g. webpack or browserify).

Add the client to your project:
```
npm install @arso-project/sonar-client
```

Then, you can import the client and start using it.

```javascript
const Client = require('@arso-project/sonar-client')
const client = new Client(opts)
```

### API

**The current API is documented in the [API docs](/apidocs-client/index.html)**

*This is a draft page for the revised client API. It is not yet complete*.

```javascript
const collection = await client.createCollection(name, opts)
const collection = await client.collection(keyOrName)
await client.listCollections

collection.key
collection.info

// Collection: Database
await collection.put()
await collection.get()
await collection.del()
await collection.query(name, args, opts)
// Collection: Subscriptions
await collection.subscribe(name, opts, callback)
// Collection: Types
await collection.putType()
// Collection: Feeds
await collection.addFeed()

// FS
await collection.fs.readFile(refOrPath)
await collection.fs.writeFile(refOrPath)
await collection.fs.createReadStream(refOrPath)
await collection.fs.createWriteStream(refOrPath)
await collection.fs.statFile(refOrPath)
await collection.fs.resolveURL(refOrPath)


// Schema
collection.schema.add(type)
collection.schema.listTypes()
collection.schema.get(name)
```

---
id: api-client
title: Client and Workspaces
---
## Intro

The primary way to interact with Sonar is through the *Sonar Client*. The Client talks to the Sonar daemon over HTTP. The Sonar daemon is part of the P2P network, exchanges data with other peers and indexes the data in your islands.

## Get started

The client works both in browsers and in NodeJS. When using in browser, you currently need to have a bundling setup that supports CommonJS (e.g. webpack or browserify).

Add the client to your project:
```
npm install @arso-project/sonar-client
```

Then, you can import the workspace class from the client and start using it. By default, it will talk to a Sonar server running on `http://localhost:9191`.

```javascript
const { Workspace } = require('@arsonar/client')
const client = new Workspace()
```

### API

**The current API is documented in the [API docs](/apidocs-client/index.html)**

*This is a draft page for the revised client API. It is not yet complete*.

```javascript
const collection = await workspace.createCollection(name, opts)
const collection = await workspace.openCollection(keyOrName)
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

If you start Sonar it comes with a Default Workspace 

When you start Sonar it provides a default workspace. Workspaces are our endpoints in which collections can be managed, more about this under the point Collections.

There can be multiple workspaces on one Sonar server.

To create a new workspace you have to pass token and URL of the server for example like this in JavaScript:

```js
/**
 * Get the URL and access token for 
 * the Sonar instance running in the background. 
 */
const url = process.env.SONAR_URL || 'http://localhost:9191/api/v1/default'
const token = process.env.SONAR_TOKEN
/**
 * Initializing a client 
 */
export const workspace = new Workspace({
  url,
  accessCode: token
});
```

Now you can create, update, open and display collections on the workspace. Furthermore the workspace offers the possibility to manage the login of the client. More about the workspace can be found in the API description: [Workspace](https://sonar-apidocs.dev.arso.xyz/Workspace.html)

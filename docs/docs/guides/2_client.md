---
id: api-client
title: Client and Workspaces
---
## Intro

The primary way to interact with Sonar is through the *Sonar Client*. The Client talks to the Sonar daemon over HTTP. The Sonar daemon is part of the P2P network, exchanges data with other peers and indexes the data in your islands.

## Get started

The client works both in browsers and in NodeJS. It is written in TypeScript and the NPM packages include versions for both CommonJS and ES modules.

To get started add the client to your project:
```
npm install @arso-project/sonar-client
```

Then, you can import the `Workspace` class from the client and start using it. By default, it will talk to a Sonar server running on `http://localhost:9191`.

```javascript
const { Workspace } = require('@arsonar/client')
const workspace = new Workspace()
```

**Note: The full JavaScript API is documented in the [API docs](/apidocs-client/index.html).**

Optionally, pass in an `options` object to set custom options:
```javascript
const opts = {
  url: 'https://sonar-endpoint.yourdomain.org/api/v1/default`,
  accessCode: 'a-sonar-acces-code'
}
const workspace = new Workspace(opts)
```

From the workspace, you can open and create *Collections*.


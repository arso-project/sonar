---
title: Running a Sonar Server
id: server
sidebar_position: 1
---

To interact with Sonar through the Command line, the JavaScript client or the user interface, you need to run a Sonar server. The server joins the Sonar peer to peer network and exposes a HTTP API to interact with the content stored on this instance. 

## Installation

You can easily install the sonar server globally through yarn or npm.
```bash
yarn global add @arsonar/server
```

Now run a Sonar server.
```bash
sonar start
```
The built-in CLI commands are documented:
```bash
sonar help
```

When including the Sonar server within a Node.js application, you can also start it programmatically.

```javascript
const Server = require('@arsonar/server/server.js')
const opts = {
  port: 9191,
  hostname: 'localhost',
  storage: './data',
}
const server = new Server(opts)
await server.start()
```

# sonar-ui

A web UI use and explore [Sonar](https://github.com/arso-project/sonar) collections.

[React](https://reactjs.org) single page application. Uses [sonar-client](../sonar-client/README.md) to talk to [sonar-server](../sonar-server/README) over HTTP.

## Usage

The Sonar UI is served whenever you start Sonar. If you start Sonar with `./sonar start --dev`, a development server for UI development with hot reloading is mounted on `http://localhost:9191/ui-dev`.

You can also start the UI standalone:

```bash
# build the UI
node bin.js ui build

# serve the UI (needs `build` first)
node bin.js ui start

# serve the UI in live dev mode
node bin.js ui dev
```

This opens a dev server on `http://localhost:55555`. It needs a running [sonar-server](../sonar-server/README.md) to work.

## Building

- `npm run build` - build js and html into `dist`
- `npm run build:static` - build the ui into a single HTML file under `dist/index.html`

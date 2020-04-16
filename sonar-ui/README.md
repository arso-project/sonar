# sonar-ui

A web UI use and explore [Sonar](https://github.com/arso-project/sonar) islands.

[React](https://reactjs.org) single page application. Uses [sonar-client](../sonar-client/README.md) to talk to [sonar-server](../sonar-server/README) over HTTP.

## Usage

```
cd sonar-ui
node bin.js ui start
# is the same as `npm start`
```

This opens a dev server on `http://localhost:55555`. It needs a running [sonar-server](../sonar-server/README.md) to work.

## Building

* `npm run build` - build js and html into `dist`
* `npm run build:static` - build the ui into a single HTML file under `dist/index.html`

## Development

`sonar ui dev` 

start the UI in development load with hot module reloading

setting `WP_RAM=1 sonar ui dev` enables a ramdisk for webpack builds (faster but may not work on all platforms)


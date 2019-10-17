# sonar-ui

A UI to Sonar.

[React](https://reactjs.org) single page application. Uses [sonar-client](../sonar-client/README.md) to talk to [sonar-server](../sonar-server/README) over HTTP.

## Usage

```
cd sonar-ui
npm start
```

This opens a dev server on `http://localhost:55555`. In another terminal, start `sonar-server`:

```
cd sonar-server
npm start
```

This starts the Sonar server listening on `http://localhost:9191`. Now open your browser at `http://localhost:55555`.

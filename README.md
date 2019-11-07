# Sonar 📡

**Sonar** is a p2p database and search engine running on top of the dat stack.

## Getting started

To get started, clone this repository and then:

```sh
# install dev dependencies
npm install
# let lerna install the dependencies of all modules
npm run bootstrap
# start sonar-server and sonar-ui
npm start
```

Usually during development, you'd start the services seperately:

```sh
# start sonar-server
cd sonar-server; npm start
# start sonar-ui
cd sonar-ui; npm start
```

Then, you can:
* open the web UI on [http://localhost:9191](http://localhost:9191).
* use the CLI:
  ```sh
  cd sonar-cli
  node cli
  node cli fs ls
  # etc.
  # the cli has a built-in help that should list the available commands
  ```

## Repo layout

This repo includes several modules. Currently, they are not yet published on npm individually.

* **[sonar-dat](sonar-dat/README.md)** connects a [hyper-content-db](https://github.com/arso-project/hyper-content-db) with a search index through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). We call these things *islands*.

* **[sonar-server](sonar-server/README.md)** this is where everything comes together. manages islands (databases), listens for connections in the p2p network, and starts an HTTP server on localhost to interact with databases, files and search indexes.

* **[sonar-client](sonar-client/README.md)** is a Javascript client speak to sonar-server over HTTP.

* **[sonar-ui](sonar-ui/README.md)** is a single-page application that talks to sonar-server and allows to search and browse files (soon also manage schemas and islands).

* **[sonar-cli](sonar-cli/README.md)** is a command-line application that uses `sonar-client` to talk to `sonar-server` 

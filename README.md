<h1 align="center">sonar</h1>
<div align="center">
 <strong>
   A p2p database and search engine running on top of the dat stack.
 </strong>
</div>
<br />

The **[Sonar book](https://https://arso-project.github.io/sonar-book/)** has more documentation (soon).

## Installation

(this is pre-alpha!)

```sh
npm install -g @arso-project/sonar-server
sonar help
sonar server start
sonar ui serve
```

## Contributing

Sonar is a young open source project and all kinds of contributions are welcome. We're in the process of writing up more documentation and overviews of how things work and come together (in a [book](https://github.com/arso-project/sonar-book)). 

If in doubt, talk to us! For example on IRC in #dat on freenode (or in the browser through [gitter](https://gitter.im/datproject/discussions).

More on this project on [arso.xyz](https://arso.xyz).

## Development

First clone this repository. The repo is structured as a monorepo of different packages (that are interdependent at several points). 

Then, to get things running:


```sh
# install dev dependencies (lerna)
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
  cd sonar-server
  node bin
  node bin fs ls
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

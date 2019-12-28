<h1 align="center">sonar</h1>
<div align="center">
 <strong>
   A p2p database and search engine running on top of the dat stack.
 </strong>
</div>
<br />

**Early stage WIP! Not yet stable in any way!**

The **[Sonar book](https://arso-project.github.io/sonar-book/)** has more documentation (soon).

## Installation

(this is pre-alpha!)

```sh
npm install -g @arso-project/sonar-server
sonar help
sonar start
```

## Development

First clone this repository. 

Then, to get things running:

```sh
# install dev dependencies (lerna)
npm install
# let lerna install the dependencies of all modules
npm run bootstrap
```

In the root folder is a symlink `sonar` that leads to `sonar-server/bin.js` which is the main entry point. Through `./sonar` you can start both the UI and the server.

```sh
# start sonar-server and server-ui in dev mode

./sonar start --dev
```

Then, you can:
* open the web UI on [http://localhost:55555](http://localhost:5555).
* use the CLI:
  ```sh
  ./sonar island create default
  ./sonar db get
  # etc.
  # the cli has a built-in help that should list the available commands
  ```

## Contributing

Sonar is a young open source project and all kinds of contributions are welcome. We're in the process of writing up more documentation and overviews of how things work and come together (in a [book](https://github.com/arso-project/sonar-book)). 

If in doubt, talk to us! For example on IRC in #dat on freenode (or in the browser through [gitter](https://gitter.im/datproject/discussions).

More on this project on [arso.xyz](https://arso.xyz).

## Repo layout

The repo is structured as a monorepo of different packages (that are interdependent at several points). 

* **[sonar-dat](sonar-dat/README.md)** it the core module. It manages *islands*, which are our notion of "a group of feeds*. Each island has a [kappa-record-db](https://github.com/arso-project/kappa-record-db) that's plugged into a search index through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). Each island has also a list of associated [hyperdrives](https://github.com/mafintosh/hyperdrive).

* **[sonar-server](sonar-server/README.md)** provides a REST style HTTP api that's used both by the CLI and the UI to access and manage the data in sonar-dat.

* **[sonar-client](sonar-client/README.md)** is a Javascript client library. It's used by both the CLI and the UI. It speaks to sonar-server over HTTP.

* **[sonar-ui](sonar-ui/README.md)** is a single-page application to browse data in Sonar.

* **[sonar-cli](sonar-cli/README.md)** is a command-line application. It can manage islands, put and get into the database, upload and download files, and make search queries.

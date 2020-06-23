<h1 align="center">sonar</h1>
<div align="center">
 <strong>
   A p2p database and search engine running on top of the dat stack.
 </strong>
</div>
<br />

This is the main repository of Sonar. The usual setup is that you run `sonar-server` on localhost and then interact with Sonar through the [client](sonar-client/REAMDE.md), the UI running on [http://localhost:9191](http://localhost:9191) or the [CLI](sonar-cli/README.md). The CLI can be invoked with `./sonar` from the root of this repository, and is also used to start the server.

The **[Docs website](https://sonar.dev.arso.xyz)** has more documentation (WIP).

## Installation

```sh
npm install -g @arso-project/sonar-server
sonar help
sonar start
```

## Development

> Note: At the moment [yarn 1](https://classic.yarnpkg.com/) is recommended, please [install it according to the instructions](https://classic.yarnpkg.com/en/docs/install#debian-stable).


```sh
# clone the sonar repository
git clone https://github.com/arso-project/sonar.git
cd sonar
# install dependencies of all workspaces
yarn
# (re)build the user interface and docs
yarn run rebuild
```

Instead of yarn, lerna works too:
```sh
npm install -g lerna
lerna bootstrap
```
Yarn is recommended because it's much faster.

You can start sonar with `./sonar` from the repository root.

If the start fails with errors related to `sonar-tantivy`, try to redownload or rebuild sonar-tantivy (the search engine included in sonar):

```
yarn run build:sonar-tantivy
```

```sh
# start the sonar server
./sonar start

# start the sonar server in dev mode
./sonar start --dev

```

Then, you can:
* open the web UI on [http://localhost:9191](http://localhost:9191).
* use the CLI:
  ```sh
  ./sonar collection create default
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

* **[sonar-core](sonar-core/README.md)** it the core module. It manages *collections*, which are our notion of "a group of feeds*. Each collection has a [kappa-record-db](https://github.com/arso-project/kappa-record-db) that's plugged into a search index through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). Each collection has also a list of associated [hyperdrives](https://github.com/mafintosh/hyperdrive).

* **[sonar-server](sonar-server/README.md)** provides a REST style HTTP api that's used both by the CLI and the UI to access and manage the data in sonar-core.

* **[sonar-client](sonar-client/README.md)** is a Javascript client library. It's used by both the CLI and the UI. It speaks to sonar-server over HTTP.

* **[sonar-ui](sonar-ui/README.md)** is a single-page application to browse data in Sonar.

* **[sonar-cli](sonar-cli/README.md)** is a command-line application. It can manage collections, put and get into the database, upload and download files, and make search queries.

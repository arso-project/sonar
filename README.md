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

Sonar requires Node.js version 16 or higher. If your system ships an older version, you can use a tool like [NVM](https://github.com/nvm-sh/nvm) to install an up-to-date version. On Debian-based system, you can also try the Node.js distributions from [Nodesource](https://github.com/nvm-sh/nvm).

You can check your Node.js version by running `node --version` on a command-line.

Afterwards, install Sonar with the following command:
```sh
npm install -g @arsonar/server
```

You  can then run the `sonar` command-line interface. With this, you can both start the server and interact with it from the command-line.
```sh
# show help
sonar help
# show help for specific commands
sonar help collection
# start a server
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
# build the typescript modules and bundle the UI
yarn run build
```

You can start sonar with `./sonar` from the repository root.

If the start fails with errors related to `sonar-tantivy`, try to redownload or rebuild sonar-tantivy (the search engine included in sonar):

```
yarn run rebuild:tantivy
```

If the start fails with errors related to `client`, try to rebuild client :

```
yarn run build:client
```

```sh
# start the sonar server
./sonar start

# start the sonar server in dev mode
./sonar start --dev

```

## Running the examples

This repo includes a few examples. To run them locally, do the following:

```sh
# build the typecript modules
yarn build
# start sonar
./sonar start --disable-authentication --dev
# run the example from the examples/ folder
yarn example react
```

## Using the CLI

Run `./sonar help` for a list of supported commands.

## Contributing

Sonar is a young open source project and all kinds of contributions are welcome. We're in the process of writing up more documentation and overviews of how things work and come together (in a [book](https://github.com/arso-project/sonar-book)).

If in doubt, talk to us! For example on IRC in #dat on freenode (or in the browser through [gitter](https://gitter.im/datproject/discussions).
More on this project on [arso.xyz](https://arso.xyz).

## Repo layout

The repo is structured as a monorepo of different packages (that are interdependent at several points).

- **[core](packages/core/README.md)** it the core module. It manages _collections_, which are our notion of "a group of feeds\*. Each collection has a [kappa-record-db](https://github.com/arso-project/kappa-record-db) that's plugged into a search index through [tantivy](https://github.com/arso-project/packages/tantivy). Each collection has also a list of associated [Hyperblobs](https://github.com/andrewosh/hyperblobs) to store raw file contents.

- **[server](packages/server/README.md)** provides a REST style HTTP api that's used both by the CLI and the UI to access and manage the data in packages/core.

- **[client](packages/client/README.md)** is a Javascript client library. It's used by both the CLI and the UI. It speaks to packages/server over HTTP.

- **[ui](packages/ui/README.md)** is a single-page application to browse data in Sonar.

- **[cli](packages/cli/README.md)** is a command-line application. It can manage collections, put and get into the database, upload and download files, and make search queries.

## Support

This project was kindly supported by [NLNet](https://nlnet.nl) in the Next Generation Search & Discovery program.

![logo](https://nlnet.nl/image/logo_nlnet.svg)

---
title: Run a Server
id: runServer
---

The usual setup is that you run sonar-server on localhost and then interact with Sonar through the client, the UI running on http://localhost:9191 or the CLI. The CLI can be invoked with ./sonar from the root of this repository, and is also used to start the server.

## Installation

```bash
npm install -g @arsonar/server
sonar help
sonar start
```

## Development

> Note: At the moment [yarn 1](https://classic.yarnpkg.com/) is recommended, please [install it according to the instructions](https://classic.yarnpkg.com/en/docs/install#debian-stable).

```bash
# clone the sonar repository
git clone https://github.com/arso-project/sonar.git
cd sonar
# install dependencies of all workspaces
yarn
# (re)build the user interface and docs
yarn run rebuild
# when developing on something that uses the ESM version of the
# `@arsonar/client` library: watch and rebuild on changes.
yarn dev:client
```

You can start sonar with `./sonar` from the repository root.

If the start fails with errors related to `sonar-tantivy`, try to redownload or rebuild sonar-tantivy (the search engine included in sonar):

```
yarn run build:sonar-tantivy
```

If the start fails with errors related to `client`, try to rebuild client :

```
yarn run build:client
```

```bash
# start the sonar server
./sonar start

# start the sonar server in dev mode
./sonar start --dev

```

## Running the examples

This repo includes a few examples. To run them locally, do the following:

```bash
# build the client library
yarn build:client
# start sonar
./sonar start --disable-authentication --dev
# run the example from the examples/ folder
yarn example react
```

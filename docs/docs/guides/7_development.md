---
title: Development
id: development
sidebar_position: 20
---

## Development

> Note: At the moment [yarn 1](https://classic.yarnpkg.com/) is recommended, please [install it according to the instructions](https://classic.yarnpkg.com/en/docs/install#debian-stable).

```bash
# clone the sonar repository
git clone https://github.com/arso-project/sonar.git
cd sonar
# install dependencies of all workspaces
yarn
# build the TypeScript packages and user interface
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

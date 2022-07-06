---
title: Running a Sonar Server
id: server
sidebar_position: 1
---

To interact with Sonar through the Command line, the JavaScript client or the user interface, you need to run a Sonar server. The server joins the Sonar peer to peer network and exposes a HTTP API to interact with the content stored on this instance. 

## Installation

You can easily install the sonar server globally through yarn or npm.
```bash
yarn global add @arsonar/server
```

Now run a Sonar server.
```bash
sonar start
```
The built-in CLI commands are documented:
```bash
sonar help
```

When including the Sonar server within a Node.js application, you can also start it programmatically.

```javascript
const Server = require('@arsonar/server/server.js')
const opts = {
  port: 9191,
  hostname: 'localhost',
  storage: './data',
}
const server = new Server(opts)
await server.start()
```

## Usage

The Sonar server ships a (small) CLI that allows to interact with a running server through the command line. Currently, Sonar is mostly focused at being used programmatically through the JavaScript client. See the next section for an intro.

In the following section, we'll outline how Sonar can be used on the command line. As Sonar is a peer-to-peer tool, we'll assume that you have Sonar installed on two machines.

First, let's install and start Sonar on two machines. These can be any computer: A server, a laptop, a Raspberry Pi, etc.

> In the code samples below, lines that are typed into the terminal start with a $. Lines without a $ at the beginning show the output of the commands. Lines starting with # are comments and should be ignored.

```sh
# on machine 1
$ npm install -g @arsonar/server
$ sonar start
```
```sh
# on machine 2
$ npm install -g @arsonar/server
$ sonart start
```

Keep both commands running! For the rest of the tutorial, create a new terminal window on each machine.

Now, let's create a colletion on machine 1, and share it with machine 2.

```sh
# on machine 1
$ sonar collection create tutorial
Name:        tutorial
Primary key: 68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
Shared:      Yes
Local key:   68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
Length:      2
Feeds:
        Key: 68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
        Type: sonar.root Length: 2 Size: 157 B Writable: yes
```

This created a new collection on machine1. Now, copy the "Primary key" shown in the command's output, and run the following command on machine2. Note that `tutorial` here is just an informational name, you can chose whatever name you like and it does not have to be the same on the two machines.

```sh
# on machine 2
$ sonar collection create tutorial 68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
Name:        tutorial
Primary key: 68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
Shared:      Yes
Local key:   b9413ee100151fe0d4d9b524997151189fa7bef34c5938dd6b93dfc49ad7facd
Length:      2
Feeds:
        Key: 68c545f692d3c575b4a8d384ba896c3961e81c2c0d31c90bcec1757a15e9e7a5
        Type: sonar.root Length: 0 Size: 0 B Writable: no
        Key: b9413ee100151fe0d4d9b524997151189fa7bef34c5938dd6b93dfc49ad7facd
        Type: sonar.root Length: 2 Size: 157 B Writable: yes
```

Let's add some data to the collection on machine1. Sonar includes a few data types and schemas. You can also add your own. The simplest schema is `sonar/entity`, which is a record that only contains a label. We'll use this for the tutorial.

With the `sonar db`  commands, you can save and read records from the database in JSON format. Let's do this on machine 1.

```sh
# on machine 1
$ echo '{"label":"hello world"}' | sonar -c tutorial db put -t sonar/entity
tbn3346zvnjxag4g6xygmbd75g
```

This will print the record's ID.

The record should now automatically sync to machine 2 over Sonar's peer-to-peer network! When syncing, the full-text search index is synced as well. This means that after running the above command, you should be able to search for a term included in the record on machine 2.

Let's use the `search` command:

```sh
# on machine 1 or 2, doesn't matter because the index is synced now
$ sonar -c tutorial search hello
1 total
0  Entity  tbn3346zvnjxag4g6xygmbd75g hello world
```

Or the `db get` command to get an invididual record:

```sh
# on machine 1 or 2, doesn't matter because the index is synced now
$ sonar -c tutorial db get tbn3346zvnjxag4g6xygmbd75g
id       tbn3346zvnjxag4g6xygmbd75g
type     sonar/entity@0
version  68c54..39@3
label    "foo bar"
-------
```

That's it for now! You can explore the built-in commands using `sonar help` and `sonar help <COMMAND>` for the individual commands.

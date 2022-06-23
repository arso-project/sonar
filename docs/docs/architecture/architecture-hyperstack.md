---
id: hyperstack
title: Hypercore Protocol
---

The [Hypercore Protocol](https://hypercore-protocol.org) is the technical foundation of the [Dat project](https://dat.foundation) and the primary implementation of its protocols. It is a collection of modules written in [JavaScript](https://en.wikipedia.org/wiki/JavaScript) that run on the [Node.js](https://nodejs.org/) runtime. 

Its primary data structure is [Hypercore](https://github.com/mafintosh/hypercore), a cryptographically secure append-only plus an efficient [replication protocol](https://github.com/mafintosh/hypercore-protocol/). Each hypercore is identified by a unique public key, and internally uses merkle trees to efficiently verify that all entries to the hypercore are signed by the single matching secret key. The hypercore protocol is a binary protocol to sync two hypercores both sparsely and live over any binary stream (usually, a network socket).

The primary networking scheme of the hyperstack is [hyperswarm](https://github.com/hyperswarm/hyperswarm), a distributed networking stack for connecting peers. It allows processes and machines to find each other on mutual interest in a topic. Peers are found both in the local network and through a distributed hash table of peers. To establish connections through a variety of network configurations hyperswarm uses NAT holepunching. 

Furthermore, the hyperstack includes several data structures built on top of Hypercore, namely:

- [Hypertrie](https://github.com/mafintosh/hypertrie), a distributed key-value store. It allows to find any key in the keyspace with a small number of lookups, when all you have is the latest entry of an append-only log to start with.
- [Hyperdrive](https://github.com/mafintosh/hyperdrive), a distributed file system built upon Hypercore and Hypertrie. It maps the primitives of a POSIX file system onto a hypertrie (for directory and file lookup plus metadata) and an additional hypercore for the actual file contents. On many systems hyperdrives can be mounted as a user-space filesystem that appears like a regular folder on your local device (through [hyperdrive-fuse](https://github.com/andrewosh/hyperdrive-fuse#readme) and the [hyperdrive-daemon](https://github.com/andrewosh/hyperdrive-daemon)).

All of these data structure are by default single-writer, which means that only one secret key is allowed to publish updates to the data, and that single key is expected to reside only on a single device (otherwise forks would arise, which is not something the stack is designed to make use of and are currently considered data corruption).

Hypertrie and Hyperdrive have a concept of [mounts](https://github.com/andrewosh/mountable-hypertrie/), where specific paths in a tree may point to another tree. Because these data structures are efficient also when only sparsely synced, this opens the door to the idea of a huge grid of interlinked data structures.

The hyperstack is in the process of going though a major version upgrade oftenly dubbed Dat2. It includes *Hypercore 8*, *hypercore protocol 7*, *hyperdrive 10* and the migration from [discovery-swarm](https://github.com/mafintosh/discovery-swarm) to [hyperswarm](https://github.com/hyperswarm/hyperswarm). Sonar only uses this new major version of the stack (which is incompatible to earlier versions), and other Dat projects like Beakerbrowser are in the process of upgrading.



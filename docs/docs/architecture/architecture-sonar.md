---
title: Sonar architecture
---

# Sonar architecture

This page documents the core Sonar engine. It is implemented mostly in the `sonar-core` and `sonar-db` packages.

## High-level overview

![Sonar Core architecture](/img/sonar-core-architecture.svg)

Sonar Core forwards messages from hyper data structures into views and query engines. A **Collection** is a high-level container for a group of feeds. It includes a list of *source feeds*, a configuration of *views*, and *schemas* for data types. A collection is defined by its **root key**. By default, a collection is defined through a set of TOML or JSON files stored in a hyperdrive.

Collections can contain a list of *source feeds*. A source feed can be a hyperdrive, a sonar record feed, or (soon) other feeds like Cabal chat logs. A source feed can also be another collection, which allows for multiwriter usage.

Collections can also contain a list of *record types*. A record type defines the schema for an arbitrary data type used in the the collection.

Collection can also contain a list of query engines, called *views*. A query engine receives all records in a collection, inserts them into some index it maintains, and provides a query function.

## Collection

A `Collection` is an indexed list of feeds.

All blocks from all feeds in a collection are indexed into different `views`.
Feeds are, for Sonar, a list of `Records`.

A `Collection` is identified by a `name` and/or a `key`.

The `name` or `key` is resolved into a Hypercore feed. This feed is the `root` feed of the collection. A collection also always has a `local` feed. If the `root` feed is writable, the `local` feed is the same as the `root` feed.

The `Collection` has an `Indexer` that walks all feeds in the collection and assigns each block a local sequence number. This local log is then fed into several views that maintain indexes into the combined data from all feeds. A feed is expected to contain only `Record`s. Sonar currently supports `sonar-data` feeds with Protobuf-encoded `Record` objects, and `hyperdrive` feeds (which are converted into a stream of `Record` objects).

All Records in a collection have a unique, monotonically increasing integer ID, called `lseq` (local sequence number). 

The collection maintains several views:

- `root` view: Inserts all records with type `sonar/type` into the collection's schema. Adds all feeds from `sonar/feed` records to the indexer.
- `kv` view: Maintains an unordered materialized key-value list to map each Record address (`id/type`) to the latest `feed@seq` versions.
- `records` view: Maintains an `id:types` and `type:ids` index.
- `indexes` view: Indexes field values of fields that have the `simple` index property set.
- `search` view: A search index powered by the *Tantivy* search engine.

The views expose `queries` which are the main interface to access data in Sonar.

## Collections as ordered local logs

Each collection owns a `Indexer`, an instance of `kappa-sparse-indexer`. The `Indexer` maintains an ordered log of all downloaded blocks from all feeds in the collection. The log is an ordered set of `key@seq` block addresses. In addition to the log, it maintains a lookup table to resolve a `key@seq` address to its sequence number in the log, or `lseq`.

The log and lookup table are stored in a compact binary format in a LevelDB store. To keep the log compact, the `key` part of the block addresses is first interned (each key is assigned a uint id). 

The Indexer listens for `download` and `append` events on all feeds in a collection, and upon these events, inserts the new blocks into the log.

The Indexer exposes any number of `kappa-core` sources. A Indexer source notifies its Kappa flow of updates, and maintains the flow state. The flow state is a single integer that stores the latest `lseq` that was processed.

A kappa pipeline that starts with an Indexer source thus processes all available blocks in linear fashion. All kappa views mounted on a collection use an Indexer source. 

The Indexer supports a `load` callback option. This async callback is invoked for each block address when a kappa pipeline pull from the Indexer source. In Sonar, this callback is provided by the collection. It loads a block and decodes the Record.

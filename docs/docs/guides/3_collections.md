---
title: Collections
id: collections
---

## What is a Collection

An collection is a set of *feeds* that are shared among peers.
A feed is an append-only log of records. Each feed is only writable from a single device.
A record is a unit of data. Each record has a type and a value and is identified by an ID.

## Add or open collections

To add a new collection to the workspace you call the `createCollection()` method, and to open an existing collection use the `openCollection()` method.

Each collection is identified by a local `collectionName`, which can be any string. To open an existing remote collection, pass in that collection's key as an hex-encoded string (that means: if the `collectionName` is a valid hex-encoded collection key, than Sonar will try to open it as a remote collection. Otherwise a new collection is created.)

```js
async function getCollection(workspace: Workspace, collectionName: string): Promise<Collection> {
  try {
    collection = await workspace.openCollection(collectionName)
  } catch (err: any) {
    collection = await workspace.createCollection(collectionName)
  }
  return collection
}
```

## Collection info

Once a collection is opened, various informational fields are available on `collection.info`:

* `info.key`: The collection's primary key, as hex-encoded string. Pass this to other peers if you want to share read access to your collection.
* `info.feeds`: An array of the feeds that are part of this collection.
* `info.peers`: An array of peers the collection is connected to.

Use `await collection.updateInfo()` to ensure that you have the most up-to-date collection information, if needed.

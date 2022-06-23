---
title: Collections
id: collections
---

## What is a Collection
An collection is a set of feeds that are shared among peers.
A feed is an append-only log of records. Each feed is only writable from a single device.
A record is a unit of data. Each record has a type, a ref and a value.

When sonar is started a local collection is available by default.

Collections sind einem Workspace zugeordnet.


## add or open collection

To add a new collection to the workspace we simply call the ``createCollection()``` function to open it we use ``openCollection()``` as for example in this code snippet:


```js
/**
 * Check if the collection already exists if not create a new collection
 * @returns opened || new collection
 */
export async function Collection(): Promise<Collection> {
  if (!collection) {
    try {
      collection = await workspace.openCollection(collectionName)
    } catch (err: any) {
      collection = await workspace.createCollection(collectionName)
    }
    //  console.log('opened collection', collection.key.toString('hex'))
    await ensureSchema(collection, schema)
  }
  return collection
}
```

## delete a collection
????

## getters

Various getters are available to retrieve the parameters of the collection:


```js
  get name () {
    if (this._info) return this._info.name
    return this._nameOrKey
  }
  get key () {
    return this._info && this._info.key
  }
  get localKey () {
    return this._info && this._info.localKey
  }
  get info () {
    return this._info
  }
  get id () {
    return this._info && this._info.id
  }
  get length () {
    return this._length || this._info.length || 0
  }
```

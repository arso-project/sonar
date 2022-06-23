---
title: Search
id: search
---

To search the records of a collection we can issue a query which returns an array with the matching records.

```js
(async) query(name, args, optsopt) → {Promise.<Array.<Record>>}
```

The arguments for the query. Depends on the query being used. For records: `{ schema, name, id }` For history: `{ from: timestamp, to: timestamp }` For search: Either a "string" for a simple full-text search, or a tantivy query object. For indexes: `{ schema, prop, value, from, to, reverse, limit }` (to be documented) For relations: `{ subject, object, predicate }` where subject and object are ids and predicate is type #field

Here is a small example from our peerBooks App which will return the records for the schema Book:

```js
  const records = await collection.query('records', {
    type: 'sonar-peerBooks/Book'
  })
```
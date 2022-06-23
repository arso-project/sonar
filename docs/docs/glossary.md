---
title: Glossary
sidebar_position: 10
---

## Concepts and their names

An **collection** is a set of **feeds** that are shared among **peers**.

A **feed** is an append-only log of **records**. Each feed is only writable from a single device.

A **record** is a unit of data. Each record has a **type**, a **ref** and a **value**.

A **ref** is a unique string that identifies an **entity** - a set of records that together describe the same thing.

> Let's say you upload a picture from your last holidays. This might lead to a few records being created, all sharing the same *ref*, but with different *types*: A *file record* that stores where to find that file, an *image record* that has image-specific metadata (e.g. which which camera the picture was taken). Maybe you also want to add a description and tags to your image, which would mean another record with the same *ref* but different *types*.

A **type** is a string that defines how to understand the value of records with this type. Types are stored in Sonar as records of type `sonar.schema`. The schema describes how to validate, index, and display records of this type.
* If a type contain a dot, the type name is considered to be well-defined. That means they are usually part of the source code of an app or a bot. They should be namespaced by org and/or project name to avoid conflicts.
* If a type does not contain a dot, it will internally be prefixed with the *collection key*.
* A type is versioned. When creating new records, the current version is appended to the type.

After being saved, a record also has a **version** property, identifying the storage location of this particular version of the record. It also has an **lseq** property, which is this record version's sequence number in the local collection log.

Example:

```javascript
// We're on collection with key d78a7e3a.
const ref = await db.put({
    type: 'article',
    value: { title: 'Hello world' }
})
const record = await db.get({ ref, type: 'article' })
// Result:
{
    type: 'd78a7e3a.article@1',
    ref: 'k3ciaosof',
    value: { title: 'Hello world '},
    version: '8h54e33e@5',
    lseq: 62
}

```

An **file record** is a record that describes a file stored in a collection and has **type** `sonar.file`.

```javascript
const fileRecord = {
    type: 'sonar.file',
    ref: 'c8a9sjchja7sdfao8s8d7faos',
    value: {
        filename: 'foo.jpg',
        mimetype: 'image/jpeg',
        contentUrl: 'hyper://keyofdrive/path/to/foo.jpg'
    }
}
db.put(fileRecord)
```

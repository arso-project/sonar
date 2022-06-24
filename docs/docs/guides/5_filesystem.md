---
title: Files
id: files
---

Sonar has a simple but powerful file store built-in. It is accessible on the `collection.files` property. 

The API docs can be found [here](https://sonar.arso.xyz/apidocs-client/classes/files).

## Uploading a file or blob

```javascript
const file = await collection.files.createFile(bufferOrStream)
```

## Reading files

```javascript
const readableStream = await collection.files.readFile(fileID)
```

## Getting a HTTP URL for a file

```javascript
const url = collection.files.getURL(fileID)
```

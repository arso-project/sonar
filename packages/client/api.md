## Classes

<dl>
<dt><a href="#Workspace">Workspace</a></dt>
<dd></dd>
<dt><a href="#Collection">Collection</a></dt>
<dd></dd>
<dt><a href="#Fs">Fs</a></dt>
<dd><p>File system for a collection.</p>
</dd>
</dl>

<a name="Workspace"></a>

## Workspace

* [Workspace](#Workspace)
    * [new Workspace([opts])](#new_Workspace_new)
    * [.close()](#Workspace+close) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.listCollections()](#Workspace+listCollections) ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
    * [.createCollection(name, [opts])](#Workspace+createCollection) ⇒ [<code>Promise.&lt;Collection&gt;</code>](#Collection)
    * [.updateCollection(name, info)](#Workspace+updateCollection) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.openCollection(keyOrName)](#Workspace+openCollection) ⇒ [<code>Promise.&lt;Collection&gt;</code>](#Collection)
    * [.fetch()](#Workspace+fetch) ⇒ <code>Promise.&lt;object&gt;</code>


* * *

<a name="new_Workspace_new"></a>

### new Workspace([opts])
A Sonar workspace. Provides methods to open collection under this endpoint.

**Params**

- *opts* <code>object</code> - Optional options.
    - *url* <code>string</code> <code> = &quot;http://localhost:9191/api/v1/default&quot;</code> - The API endpoint to talk to.
    - *accessCode* <code>string</code> - An access code to login at the endpoint.
    - *token* <code>string</code> - A JSON web token to authorize to the endpoint.
    - *name* <code>string</code> - The name of this client.


* * *

<a name="Workspace+close"></a>

### workspace.close() ⇒ <code>Promise.&lt;void&gt;</code>
Closes the client.


* * *

<a name="Workspace+listCollections"></a>

### workspace.listCollections() ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
Get a list of all collections available on this endpoint.

**Returns**: <code>Promise.&lt;Array.&lt;object&gt;&gt;</code> - Promise that resolves to an array of collection info objects.  

* * *

<a name="Workspace+createCollection"></a>

### workspace.createCollection(name, [opts]) ⇒ [<code>Promise.&lt;Collection&gt;</code>](#Collection)
Creates a collection with name name on the Sonar server. The name may not contain whitespaces. opts is an optional object with:

**Returns**: [<code>Promise.&lt;Collection&gt;</code>](#Collection) - The created collection.  
**Params**

- name <code>string</code> - Name of the new collection, may not contain whitespaces.
- *opts* <code>object</code> - Optional options object.
    - *key* <code>string</code> - Hex string of an existing collection. Will then sync this collection instead of creating a new, empty collection.
    - *alias* <code>string</code> - When setting key, alias is required and is your nick name within this collection.


* * *

<a name="Workspace+updateCollection"></a>

### workspace.updateCollection(name, info) ⇒ <code>Promise.&lt;void&gt;</code>
Updates the config of a collection.

**Params**

- name <code>string</code> - Name of the collection.
- info <code>object</code> - [TODO:description]
    - share <code>boolean</code> - Controls whether a collection is shared via p2p.


* * *

<a name="Workspace+openCollection"></a>

### workspace.openCollection(keyOrName) ⇒ [<code>Promise.&lt;Collection&gt;</code>](#Collection)
Returns a Collection object for a given key or name of a collection.

**Params**

- keyOrName <code>string</code> - Key or name of the collection to open/return.


* * *

<a name="Workspace+fetch"></a>

### workspace.fetch() ⇒ <code>Promise.&lt;object&gt;</code>
Fetch a resource.

This is a wrapper around the fetch web API. It should be API compatible to fetch,
with the following changes:

**Returns**: <code>Promise.&lt;object&gt;</code> - If the response has a JSON content type header, the
   decoded JSON will be returned. if opts.responseType is 'binary' or 'text',
   the response will be returned as a buffer or text.

TODO: Rethink the default responseType cascade.  
**Params**

    - *requestType* <code>string</code> <code> = &quot;&#x27;json&#x27;&quot;</code> - Request encoding and content type.
  Supported values are 'json' and 'binary'
    - *responseType* <code>string</code> <code> = &quot;&#x27;text&#x27;&quot;</code> - Response encoding. If the response
   has a JSON content type, will always be set to 'json'.
   Supported values are 'text', 'binary' and 'stream'.
    - *params* <code>object</code> - Query string parameters (will be encoded correctly).


* * *

<a name="Collection"></a>

## Collection

* [Collection](#Collection)
    * [new Collection(workspace, nameOrKey)](#new_Collection_new)
    * [.open()](#Collection+open) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.close()](#Collection+close)
    * [.putFeed(key, [info])](#Collection+putFeed)
    * [.query(name, args, [opts])](#Collection+query) ⇒ <code>Promise.&lt;Array.&lt;Record&gt;&gt;</code>
    * [.put(record)](#Collection+put) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.get(req, [opts])](#Collection+get) ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
    * [.getVersion(address)](#Collection+getVersion)
    * [.del(record)](#Collection+del) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.putType(schema)](#Collection+putType) ⇒ <code>Promise.&lt;object&gt;</code>
    * [.createBatchStream()](#Collection+createBatchStream) ⇒ <code>Writable.&lt;Record&gt;</code>
    * [.sync()](#Collection+sync) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.createEventStream()](#Collection+createEventStream) ⇒ <code>Readable.&lt;object&gt;</code>
    * [.pullLiveUpdates()](#Collection+pullLiveUpdates)
    * [.subscribe(Subscription, Async)](#Collection+subscribe)
    * [.reindex(Optional)](#Collection+reindex)


* * *

<a name="new_Collection_new"></a>

### new Collection(workspace, nameOrKey)
Remote collection

**Params**

- workspace [<code>Workspace</code>](#Workspace) - Remote workspace
- nameOrKey <code>string</code> - Name or key of the collection


* * *

<a name="Collection+open"></a>

### collection.open() ⇒ <code>Promise.&lt;void&gt;</code>
Populate info and schemas for this collection from server.

**Throws**:

- Will throw if this collection does not exist or cannot be accessed.


* * *

<a name="Collection+close"></a>

### collection.close()
Close the collection.

Properly closes open HTTP requests.


* * *

<a name="Collection+putFeed"></a>

### collection.putFeed(key, [info])
Put a new feed to the collection.

**Params**

- key <code>string</code> - The hex-encoded key of the feed to add.
- *info* <code>object</code> - Optional information about the feed.
                         TODO: Document


* * *

<a name="Collection+query"></a>

### collection.query(name, args, [opts]) ⇒ <code>Promise.&lt;Array.&lt;Record&gt;&gt;</code>
Query the collection.

Returns an array of matching records.

Records may have a meta property that includes query-specific metadata (e.g. the score for search queries).

**Returns**: <code>Promise.&lt;Array.&lt;Record&gt;&gt;</code> - A promise that resolves to an array of record objects.  
**Params**

- name <code>string</code> - The name of a supported query.
                       Supported queries that ship with @arsonar/core are:
                       records, search, relations, history and indexes.
- args <code>object</code> - The arguments for the query. Depends on the query being used.
                       For records: `{ schema, name, id }`
                       For history: `{ from: timestamp, to: timestamp }`
                       For search: Either a "string" for a simple full-text search, or a
                          tantivy query object.
                       For indexes: `{ schema, prop, value, from, to, reverse, limit }`
                          (to be documented)
                       For relations: `{ subject, object, predicate }`
                          where subject and object are ids and predicate is `type#field`
- *opts* <code>object</code> - Optional options
    - *sync* <code>boolean</code> <code> = false</code> - Wait for all pending indexing operations to be finished.


* * *

<a name="Collection+put"></a>

### collection.put(record) ⇒ <code>Promise.&lt;object&gt;</code>
Put a new record into the collection.

**Returns**: <code>Promise.&lt;object&gt;</code> - An object with an `{ id }` property.  
**Throws**:

- Throws if the record is invalid.

**Params**

- record <code>object</code> - The record.
    - schema <code>string</code> - The schema of the record.
    - *id* <code>string</code> - The entity id of the record. If empoty an id will be created.
    - value <code>object</code> - Value of the record.


* * *

<a name="Collection+get"></a>

### collection.get(req, [opts]) ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
Get records by their semantic address (type and id) or by their storage address (key and seq).

**Returns**: <code>Promise.&lt;Array.&lt;object&gt;&gt;</code> - A promise that resolves to an array of record objects.  
**Params**

- req <code>object</code> - The get request. Either `{ type, id }` or `{ key, seq }`.
- *opts* <code>object</code> - Optional options.
    - *sync* <code>boolean</code> <code> = false</code> - Wait for all pending indexing operations to be finished.


* * *

<a name="Collection+getVersion"></a>

### collection.getVersion(address)
Get a specific version of a record.

**Params**

- address <code>string</code> - The block address of the record version `feedkey@seq`
   where `feedkey` is the hex-encoded public key of a feed and `seq` is a sequence number (uint).


* * *

<a name="Collection+del"></a>

### collection.del(record) ⇒ <code>Promise.&lt;object&gt;</code>
Deletes a record.

**Returns**: <code>Promise.&lt;object&gt;</code> - - An object with `{ id, type }` properties of the deleted record.  
**Params**

- record <code>object</code> - The record to delete. Has to have `{ id, type }` properties set.


* * *

<a name="Collection+putType"></a>

### collection.putType(schema) ⇒ <code>Promise.&lt;object&gt;</code>
Add a new type to the collection.

**Returns**: <code>Promise.&lt;object&gt;</code> - A promise that resolves to the saved schema object.  
**Throws**:

- Throws if the schema object is invalid or cannot be saved.

**Params**

- schema <code>object</code> - A schema object.


* * *

<a name="Collection+createBatchStream"></a>

### collection.createBatchStream() ⇒ <code>Writable.&lt;Record&gt;</code>
Create a writable stream to put records into the collection.

Example:
```javascript
const batchStream = collection.createBatchStream()
batch.write(record)
batch.close()
```

**Returns**: <code>Writable.&lt;Record&gt;</code> - A writable stream  

* * *

<a name="Collection+sync"></a>

### collection.sync() ⇒ <code>Promise.&lt;void&gt;</code>
Wait for all pending indexing operations to be finished.


* * *

<a name="Collection+createEventStream"></a>

### collection.createEventStream() ⇒ <code>Readable.&lt;object&gt;</code>
Subscribe to events on this collection.

Returns a readable stream that emits event objects.
They look like this:
`{ event: string, data: object }`

Events are:

* `update`: with data `{ lseq }`
* `feed`: with data `{ key }`
* `schema-update`


* * *

<a name="Collection+pullLiveUpdates"></a>

### collection.pullLiveUpdates()
Pull live updates from the server as they happen.

After calling this method once, all new records and record versions
are pulled from the server once available. The `update` event
is emitted when new records are about to arrive.


* * *

<a name="Collection+subscribe"></a>

### collection.subscribe(Subscription, Async)
Subscribe to this collection.

This will fetch all records from the first to the last and then waits for new records.
Currently only intended for usage in bots (not in short-running Browser clients).

**Todo:**: Prefix client ID to subscription name.  
**Todo:**: Allow to subscribe from now instead of from the beginning.  
**Params**

- Subscription <code>string</code> - name. Has to be unique per running Sonar instance
- Async <code>function</code> - callback function that will be called for each incoming record


* * *

<a name="Collection+reindex"></a>

### collection.reindex(Optional)
Reindex the secondary indexes (views) in this collection.

Use with care, this can be expensive.

**Params**

- Optional <code>Array.&lt;string&gt;</code> - array of view names to reindex.
 If unset all views will be reindexed.


* * *

<a name="Fs"></a>

## Fs
File system for a collection.


* [Fs](#Fs)
    * [new Fs(collection)](#new_Fs_new)
    * [.listDrives()](#Fs+listDrives) ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
    * [.createFile(stream, [metadata], [opts])](#Fs+createFile) ⇒ <code>Record</code>
    * [.updateFile(id, stream, [metadata], [opts])](#Fs+updateFile) ⇒ <code>Record</code>
    * [.readFile(id, [opts])](#Fs+readFile) ⇒ <code>Promise.&lt;(ArrayBuffer\|Buffer)&gt;</code>
    * [.getFileMetadata(id)](#Fs+getFileMetadata) ⇒ <code>Promise.&lt;object&gt;</code>


* * *

<a name="new_Fs_new"></a>

### new Fs(collection)
File system for a collection.

**Params**

- collection [<code>Collection</code>](#Collection) - Collection


* * *

<a name="Fs+listDrives"></a>

### fs.listDrives() ⇒ <code>Promise.&lt;Array.&lt;object&gt;&gt;</code>
List the drives that are part of this collection.

**Returns**: <code>Promise.&lt;Array.&lt;object&gt;&gt;</code> - Array of drive objects with keys `{ alias, key, writable }`  

* * *

<a name="Fs+createFile"></a>

### fs.createFile(stream, [metadata], [opts]) ⇒ <code>Record</code>
Create a new file

**Returns**: <code>Record</code> - - The created file record  
**Params**

- stream <code>Stream</code> | <code>Buffer</code> - File content as stream or buffer
- *metadata* <code>object</code> - File record metadata (see file record schema)
- *opts* <code>object</code> - Options.
 - onUploadProgress: Callback to invoke with upload progress information


* * *

<a name="Fs+updateFile"></a>

### fs.updateFile(id, stream, [metadata], [opts]) ⇒ <code>Record</code>
Update a file

**Returns**: <code>Record</code> - - The created file record  
**Params**

- id <code>string</code> - The file record id
- stream <code>Stream</code> | <code>Buffer</code> - File content as stream or buffer
- *metadata* <code>object</code> - File record metadata (see file record schema)
- *opts* <code>object</code> - Options.
 - onUploadProgress: Callback to invoke with upload progress information


* * *

<a name="Fs+readFile"></a>

### fs.readFile(id, [opts]) ⇒ <code>Promise.&lt;(ArrayBuffer\|Buffer)&gt;</code>
Read a file into a buffer.

**Returns**: <code>Promise.&lt;(ArrayBuffer\|Buffer)&gt;</code> - The file content. A Buffer object in Node.js, a ArrayBuffer object in the browser.  
**Throws**:

- Will throw if the path is not found.

**Params**

- id <code>string</code> - A file ID
- *opts* <code>object</code> - Options. TODO: document.


* * *

<a name="Fs+getFileMetadata"></a>

### fs.getFileMetadata(id) ⇒ <code>Promise.&lt;object&gt;</code>
Get the metadata for a file

**Returns**: <code>Promise.&lt;object&gt;</code> - The file record value (metadata)  
**Throws**:

- Will throw if the path is not found.

**Params**

- id <code>string</code> - A file ID


* * *


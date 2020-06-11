# sonar-client

A JavaScript client for Sonar.

The client talks to [`sonar-server`](../sonar-server/README.md) over HTTP. Authentication is not yet implemented, so currently the expectation is that a server is running on localhost.

### Usage

`npm install @arso-project/sonar-client`

```javascript
const Client = require('@arso-project/sonar-client')
const client = new Client()

```

## API

#### `const client = new SonarClient(opts)`

Create a new SonarClient. `opts` is an object with optional keys:

- `endpoint`: The API endpoint to talk to. Default is `http://localhost:9191/api`
- `collection`: The collection to talk to. Default is `default`.
- `cache`: Cache records locally in memory. Default is `true`

### Collections

#### `await client.info()`

Get a list of all collections available on this server.

#### `await client.createCollection(name, [opts])`

Creates a collection with name `name` on the Sonar server. The name may not contain whitespaces. `opts` is an optional object with:

- `key`: Hex string of an existing collection. Will then sync this collection instead of creating a new, empty collection.
- `alias`: When setting key, `alias` is required and is your nick name within this collection.

#### `await client.updateCollection(config, [key])`

Updates the config of the current collection or the collection with the optional parameter *key*.

Currently only the config option *share* (boolean) is supported that controls if an collection is shared via p2p.

### Schemas

#### `await client.getSchemas()`

Get all schemas in the current collection.

#### `await client.getSchema(schemaName)`

Get schema `schemaName` in this collection. Throws if the schema does not exist.

#### `await client.putSchema(schemaName, schema)`

Add an new schema to the collection. `schemaName` is a string, `schema` a [JSON schema](https://json-schema.org/) object.

### Sources

#### `client.putSource(key, info)`

Adds a source new source with key `key` to the collection. `key` should be the key of the local writer of a clone of this collection.

### Database

#### `await client.get({ schema, id }, [opts])`

Get records by `schema` and `id`. This returns an array of matching records.

#### `await client.put(record)`

Put a new record into the database. `record` is an object that looks like this:
```
{
  schema: "string",
  id: "string",
  value: object
}
```

If `id` is empty, a new id will be generated. `schema` and `value` are required.

#### `await client.query(name, args, [opts])`

Query the database. Returns an array of matching records. Records may have a `meta` property that includes query-specific metadata (e.g. the score for search queries).

* `name`: The name of a supported query. Options at the moment are `search`, `records`, `history` and `indexes`
* `args`: The arguments for the query. Depends on the query being used.
    * For `records`: `{ schema, name, id }`
    * For `history`: `{ from: timestamp, to: timestamp }`
    * For `search`: Either a `"string"` for a simple full-text search, or an tantivy query object (to be documented)
    * For `indexes`: `{ schema, prop, value, from, to, reverse, limit }` (to be documented)

#### `await client.sync([views])`

Wait until all running operations are finished. This returns once all currently running indexing batches are finished. If you did any put or delete operations before this function will return once those are commited to all indexes. In case of pending incoming messages from remote feeds, the current indexing run is awaited.

* `views`: Optional. String of a view name or array of view names to wait for being finished. View names are the same as the query names above.


### Files

#### `await client.getDrives()`

Get a list of Hyperdrives that are part of this collection.

#### `await client.writeFile(path, file, [opts])`

Write a file. 
* `path`: The path to the file. The first path segment must be the key or alias of a hyperdrive registered in this collection.
* `file`: Either a readable stream or a buffer.

#### `await client.readFile(path, [opts])`

Read a file. 

* `path`: The path to the file. The first path segment must be the key or alias of a hyperdrive registered in this collection.

Returns a readable stream to the file. If `opts.stream` is false returns a Buffer.

#### `await client.statFile(path)`

Get the stat info for a path.

#### `await client.readDir(path)`

Get the directory listing for a path.


### Resources

Resources are files with attached metadata.

#### `await client.createResource(value, [opts])`

Create a new resource file.

`value` is an object with a required `filename` and optional `prefix`. This will create a new resource for a file in the default writable hyperdrive at path `prefix/filename`. 

Options are: 

* `force`: Create resource even if a file for the path already exists (default false).
* `update`: Update resource if a resource for the file already exists.

Returns the resource record object.

#### `await client.writeResourceFile(record, file, [opts])`

Write the file attached to a resource. 

* `record` is a resource record as returned from `createResourceFile` or as returned from a query.

* `file` is a readable stream or a buffer.

#### `await client.readResourceFile(record, [opts])`

Read the file attached to a resource. 

* `record` is a resource record as returned from `createResourceFile` or as returned from a query.

* `opts` are the same as `readFile`

### Subscriptions

#### `await client.pullSubscription(name, [opts])`

Pull the subscription `name`. Returns an object with a batch of messages:
```javascript
{
  messages: [], // Array of records
  finished: bool, // true if no more records are available
  cursor: number // the lseq of the last record returned
}
```

#### `await client.ackSubscription(name, lseq)`

Set the subscription cursor to `lseq`. Note that you cannot acknowledge individual messages, but set the cursor (position in local total log of an collection). The `lseq` is available on each record. Usually, you want to process messages linearily as returned from `pullSubscription` and set the cursor after each processed message.

### Commands

TODO.



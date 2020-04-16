# sonar-client

A JavaScript client for Sonar.

### Usage

`npm install @arso-project/sonar-client`

```javascript
const SonarClient = require('@arso-project/sonar-client')

// endpoint: default is http://localhost:9191/api
// island: default is 'default'
const client = new SonarClient(endpoint, island)

```

## API

#### `const client = new SonarClient([endpoint], [island])`

Create a new SonarClient.

- endpoint: default is http://localhost:9191/api
- island: default is 'default'

#### `client.info`

Returns information about the islands the Sonar server manages.

#### `client.createIsland(name, [opts])`

Creates a island with name *name* on the Sonar server. The name can not contain whitespaces.

- The optional *opts* parameter can contain a *alias* option, that can be used to have an additional descriptor for an island.

#### `client.getSchemas`

Returns all schemas for the current island.

#### `client.getSchema(schemaName)`

Returns the schema with name *schemaName* for the current island. 

#### `client.putSchema(schemaName, schema)`

Adds schema *schema* (in JSON schema format) with name *schemaName* to the current island.

#### `client.putSource(key, info)`

Adds a source (TODO: Explain) 
TODO

#### `client.writeResourceFile(record, file, [opts])`

#### `client.readResourceFile(record)`

#### `client.createResource(value, [opts])`

#### `client.get({schema, id}, [opts])`

Returns a record of *schema* with *id*.

#### `client.put(record)`

Saves a new record (= {schemaName, id, value}) in the current island.

#### `client.query(name, args, [opts])`

#### `client.search(query)`

#### `client.updateIsland(config, [key])`

Updates the config of the current island or the island with the optional parameter *key*.

Currently only the config option *share* (boolean) is supported that controls if an island is shared via p2p.

#### `client.getDrives`

#### `client.readDir(path)`

#### `client.writeFile(path, file, [opts])`

#### `client.readFile(path)`

#### `client.statFile(path)`

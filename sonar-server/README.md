# Sonar-server

## API

### Create island

`curl -XPUT http://localhost:9191/_create/<islandName>`

### Add record

`curl -H "Content-Type: application/json" -XPOST http://localhost:9191/<key>/<schemaName> -d '{"name": "Test doc"}'`

### Get record

`curl http://localhost:9191/<key>/<schemaName>/<id>`

### Set schema

`curl -H "Content-Type: application/json" -XPUT http://localhost:9191/<key>/<schemaName>/_schema -d '{"properties": {"name": {"type": "text", "index": true }}}'`

### Get schema

`curl http://localhost:9191/<key>/<schemaName>/_schema`

### Search

`curl http://localhost:9191/54d722bf355f5182931a59a9375dd0cd84883fae5acdfc4d568ace8d42c82fca/doc/_search -d '"test"' -H "Content-Type: application/json"`

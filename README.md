# Sonar

**Sonar** is a p2p database and search index running on top of the dat stack.

* [sonar-dat](sonar-dat/README.md) connects a [hyper-content-db](https://github.com/arso-project/hyper-content-db) with a search index through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). We call these things *islands*.
* [sonar-server](sonar-server/README.md) provides an HTTP api to connect to islands, manipulate and search them.
* [sonar-client](sonar-client/README.md) provides a javascript api to speak to sonar-server.

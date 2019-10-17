# Sonar 📡

**Sonar** is a p2p database and search engine running on top of the dat stack.

* **[sonar-dat](sonar-dat/README.md)** connects a [hyper-content-db](https://github.com/arso-project/hyper-content-db) with a search index through [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). We call these things *islands*.
* **[sonar-server](sonar-server/README.md)** provides an HTTP api to connect to islands, manipulate and search them.
* **[sonar-client](sonar-client/README.md)** is a Javascript client speak to sonar-server over HTTP.
* **[sonar-ui](sonar-ui/README.md)** is a single-page application that talks to sonar-server and allows to search and browse files (soon also manage schemas and islands).

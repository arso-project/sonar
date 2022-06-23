---
id: tantivy
title: Tantivy
---

[Tantivy](https://github.com/tantivy-search/tantivy) is a full-text search engine written in [Rust](https://www.rust-lang.org). In Sonar, we integrate Tantivy with our peer-to-peer database through a [sonar-tantivy](https://github.com/arso-project/sonar-tantivy). It uses tantivy as a library, and runs as a standalone binary which is started by a Node.js module.

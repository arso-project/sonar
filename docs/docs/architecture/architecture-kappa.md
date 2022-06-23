---
id: kappa
title: Kappa Architecture
---

Sonar follows a design oftenly labeled the *Kappa architecture*. Its basic concept is that each user has a local database into which data from several single-writer logs are aggregated. Our JavaScript implementation is [kappa-core](https://github.com/kappa-db/kappa-core) plus an emerging set of modules for different types of views (roughly comparable to database tables in that they usually aggregate append-only data e.g. into key-value stores with support for conflict resolution primitives. This ecosystem is developent by different projects that are based around sets of Hypercores, e.g. [Cabal](https://cabal.chat) and [Mapeo](https://www.digital-democracy.org/mapeo/) and [peermaps](https://peermaps.org). Currently, there's ways being developed to nicely deal with these sets of hypercores, asking peers for interesting parts, and replicating those efficiently.

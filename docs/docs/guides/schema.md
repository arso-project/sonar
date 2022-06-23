---
id: api-schema
title: Data model and Schema
---

## Data model

This document outlines the Sonar data model.

The basic unit of information in Sonar is a *Record*. A *Record* has the following required fields:

* `id`: A string that identifies the entity that this record describes.
* `type`: A string identifying the type of this record
* `value`: The value object

After being inserted into the database, a record will have these additional fields upon loading:

* `version`: The `key@seq` string that uniquely identifies this record version
* `lseq`: The local sequence number of this record
* `links`: List of `key@seq` links that this record makes obsolete
* `timestamp` Timestamp when this record was saved


## Working with schema

When getting Sonar records from the database, they are upcasted into `Record` object that, in addition to the above mentioned properties, have methods that allow to introspect the Record via its type's spec.

* `record.fields()`: Get a list of `FieldValue`s for this record
* `record.getOne(field)`: Get a single value for a field
* `record.getMany(field)`: Get all current values for a field
* `record.goto(field)`: Follow a relation field

> TODO: support `schema.map(record, targetSchema)`: Map a record onto a target schema. Returns an array of fields


## Defining schema

A schema is an object describing the fields this content type has. 


### Type props

* `name: string`: Name (required). May only contain numbers and letters. (*TODO: Enforce this*)
* `namespace: string `: Namespace (required, default is the collection key)
* `version: number`: Type version (required, default 0)

Every type has a derived `address` property that has to be unique per collection and has the format `namespace/name@version`. *(TODO: Finish conflict story)*

* `refines: string`: Type address of a parent type. This means this type inherits all fields and props of it's parent. It is considered to be a subclass of its parent for queries and indexing.


### Field types

Sonar supports the basic JSON types: `string`, `number`, `boolean`. `object` and `array` are supported, but cannot be indexed at the moment. Additionally, there are types that bring default indexing strategies with them:

* `float`, `uint`, `int`: These types behave like `number` in JavaScript, but are validated and may lead to different indexing strategies for view.
* `relation`: Relation fields have these default props: `{ search: { facet: true } }` and a basic relation index (in `sonar-view-relation`) indexes all relations in a quadstore. The value has to be a valid Sonar entity ID.

    > TODO: We also want to support a `idPrefix` prop, and maybe a way to reference not entity IDs, but specific Record versions.

* `text`: Text fields are like `string` fields, but are fields that have long text. Default props: `{ search: { bodytext: true } }`.


### Field props

Each field can have properties. The supported properties are: 

* `type: string` One of the Sonar field types (required)
* `title: string` Field title
* `description: string` Field description (used by sonar-ui)
* `multiple: false` The field value is an array of values. This is preferred to the `array` type if each value should be indexed on its own.
* `index: object`: Indexing props (see below)

Additionally, a number of JSON Schema props and extensions are supported to various degrees (*TODO: Document what is supported in what ways*).

Every field has a derived `address` property of the format `namespace/name@version#fieldname`

#### Indexing props

Each field can have an `index` property object. The keys are the names of indexing engines. The value differs per indexing engine.

Indexing props can also be set on a type. If set on the type, these props are the default for all fields of this type.

##### `search`

The `search` view uses [sonar-tantivy](https://github.com/arso-project/sonar-tantivy/) to create a full-text search index.

*Field-level props*

* `indexed: false` Index this field in the search index. 
* `record: basic|freq|position`: Index only the entity ID (`basic`), term frequenceies (`freq`) or term frequencies and term positions (`position`) (Default: `position`) *Applies only to `string` and `text` fields*
* `facet: false` Index this field as a facet field (so it can be filtered on in queries)
* `tokenizer: 'default'`: Set the tokenizer for this field. Valid values are `default`, `de/DE`, `en/US`, etc *(TODO: Link to list of available tokenizers)*
* `fastfield: false`: Index as fast field (number fields only)
* `body: true`: Index this field, stringified, into the `body` field of the search index.
* `title: false`: Index this field into the `title` field of the search index.

The Tantivy field type is derived from the Sonar field type *(TODO: Document the map from Sonar to Tantivy field types)*.

### Example A simple schema definition looks like this:

```javascript
const spec = {
  title: 'Notes',
  fields: {
    title: {
      type: 'string',
      title: 'Title',
      index: {
        search: { title: true }
      }
    },
    body: {
      type: 'text'
      title: 'Body',
      index: {
        // This could also be the default by field type
        search: { bodytext: true }
      }
    },
    date: {
      type: 'date',
      title: 'Date',
      index: {
        basic: true,
        search: { facet: true }
      }
    },
    tags: {
      type: 'string',
      multiple: true,
      title: 'Tags',
      index: {
        basic: true,
        search: { facet: true }
      }
    },
    author: {
      type: 'relation',
      title: 'Author'
    }

  }
}
```


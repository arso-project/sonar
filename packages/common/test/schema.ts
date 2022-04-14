import tape from 'tape'
/* @ts-ignore */
import table from 'text-table'
import { Schema, Store } from '../index.js'
tape('basics', t => {
  const schema = new Schema({ defaultNamespace: 'sonar' })
  schema.addType({
    name: 'entity',
    fields: {
      label: {
        type: 'string',
        title: 'Label'
      },
      tags: {
        type: 'relation',
        title: 'Tags',
        multiple: true
      }
    }
  })
  // console.log(schema)
  // console.log('entity', schema.getType('entity'))
  // console.log('entity json schema', schema.getType('entity').toJSONSchema())
  // return t.end()
  schema.addType({
    name: 'file',
    title: 'File',
    refines: 'entity',
    fields: {
      filename: {
        type: 'string',
        refines: 'entity#label',
        title: 'Filename'
      },
      size: {
        type: 'string',
        title: 'File size'
      }
    }
  })
  schema.addType({
    name: 'video',
    refines: 'sonar/file',
    fields: {
      duration: {
        type: 'string',
        title: 'Duration',
        index: {
          search: {
            // field: true
            // bodytext: true
            // facet: true
          }
        }
      }
    }
  })
  // schema.build(true)
  const record = schema.Record({
    id: 'avideo',
    type: 'video',
    key: 'f1',
    seq: 1,
    value: {
      duration: '1h20min',
      filename: 'avideo.mp4',
      size: '200mb',
      label: 'A video label',
      tags: ['atag1', 'atag2']
    }
  })
  const store = new Store({ schema })
  store.cacheRecord(record)
  // console.log('\n# Table\n')
  // const rows = [['ID', 'Field', 'Value']]
  // for (const fieldValue of record.fields()) {
  //   rows.push([record.id, fieldValue.fieldAddress, fieldValue.value])
  // }
  // console.log(table(rows))
  // console.log('\n# Human readable fields\n')
  // for (const fieldValue of record.fields()) {
  //   console.log(fieldValue.title, ':', fieldValue.value)
  // }
  // console.log('\n# Get tag labels (Tags missing)\n')
  // for (const tag of record.gotoMany(store, 'tags')) {
  //   console.log('Label: ' + tag.getOne('label'))
  // }
  const tag1 = schema.Record({
    id: 'atag1',
    type: 'entity',
    value: { label: 'A Tag!' }
  })
  const tag2 = schema.Record({
    id: 'atag2',
    type: 'entity',
    value: { label: 'Cool things' }
  })
  store.cacheRecord(tag1)
  store.cacheRecord(tag2)
  // console.log('\n# Get tag labels (Tags present)\n')
  // for (const tag of record.gotoMany(store, 'tags')) {
  //   console.log('Label: ' + tag.getOne('label'))
  // }
  // // console.log('record label', record.field('entity#label').value)
  // console.log('record label', record.get('entity#label'))
  // console.log('record label', record.field('entity#label').value)
  // console.log('record labels', record.fields('entity#label').value)
  // console.log('record labels', record.values('label'))
  // console.log('record size', record.get('size'))
  // console.log('record is video', record.hasType('video'))
  // console.log('record is file', record.hasType('file'))
  const file = schema.Record({
    id: 'avideo',
    type: 'entity',
    value: {
      label: 'A Video!'
    }
  })
  const entity = schema.Entity([record, file])
  // console.log('entity has types', entity.id, entity.getTypes().map(t => t.title))
  // console.log('entity label', entity.get('entity#label'))
  // console.log('entity labels', entity.values('entity#label'))
  // console.log('entity size', entity.field('file#size').value)
  // console.log('entity filename', entity.field('file#filename').value)
  // console.log('entity duration', entity.get('video#duration'))
  // console.log('entity triples', toTriples(entity))
  // console.log('entity is video', entity.hasType('sonar/video'))
  t.end()
})
tape('relations', t => {
  const schema = new Schema()
  schema.setDefaultNamespace('sonar')
  schema.addType({
    name: 'entity',
    fields: {
      label: {
        type: 'string'
      }
    }
  })
  schema.addType({
    name: 'file',
    refines: 'entity',
    fields: {
      size: {
        type: 'string'
      }
    }
  })
  schema.addType({
    name: 'tag',
    fields: {
      name: {
        type: 'string',
        refines: 'entity#label'
      },
      target: {
        type: 'relation',
        targetTypes: ['entity']
      }
    }
  })
  const file = schema.Record({
    id: 'afile',
    type: 'file',
    value: {
      label: 'File A',
      size: '100mb'
    }
  })
  const file2 = schema.Record({
    id: 'bfile',
    type: 'file',
    value: {
      label: 'File B',
      size: '5gb'
    }
  })
  const tag = schema.Record({
    id: 'atag',
    type: 'tag',
    value: {
      name: '#cool',
      target: ['afile', 'bfile', 'cfile']
    }
  })
  const store = new Store({ schema })
  store.cacheRecord(tag)
  store.cacheRecord(file)
  store.cacheRecord(file2)
  t.deepEqual(tag.getOne('target'), ['afile', 'bfile', 'cfile'])
  // TODO: Readd goto?
  // t.equal(tag.gotoOne(store, 'target').get('label'), 'File A')
  // const labels = tag.gotoMany(store, 'target').map(e => e.get('label'))
  // t.equal(labels.length, 3)
  // t.equal(labels[0], 'File A')
  // t.equal(labels[1], 'File B')
  // t.equal(labels[2], undefined)
  t.end()
})

const tape = require('tape')
const Schema = require('../schema')

tape('basics', t => {
  const schema = new Schema()

  schema.setDefaultNamespace('sonar')

  schema.addType({
    name: 'entity',
    fields: {
      label: {
        type: 'string',
        title: 'Label'
      }
    }
  })

  schema.addType({
    name: 'file',
    title: 'File',
    refines: 'entity',
    fields: {
      filename: {
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
        title: 'Duration'
      }
    }
  })

  schema.build(true)

  const record = schema.Record({
    id: 'avideo',
    type: 'video',

    value: {
      duration: '1h20min',
      filename: 'avideo.mp4',
      size: '200mb',
      label: 'A video label'
    }
  })

  for (const fieldValue of record.fields()) {
    console.log(fieldValue.title, ':', fieldValue.value)
  }

  // console.log('record label', record.field('entity#label').value)
  console.log('record label', record.get('entity#label'))
  console.log('record label', record.field('entity#label').value)
  console.log('record labels', record.fields('entity#label').value)
  console.log('record labels', record.values('label'))
  console.log('record size', record.get('size'))
  // console.log('record json', record.toJSON())
  // console.log('record value', record.value)
  console.log('record is video', record.is('video'))
  console.log('record is file', record.is('file'))

  const file = schema.Record({
    id: 'avideo',
    type: 'entity',
    value: {
      label: 'A Video!'
    }
  })

  const entity = schema.Entity([record, file])
  console.log('entity has types', entity.id, entity.types().map(t => t.title))
  console.log('entity label', entity.get('entity#label'))
  console.log('entity labels', entity.values('entity#label'))
  console.log('entity size', entity.field('file#size').value)
  console.log('entity filename', entity.field('file#filename').value)
  console.log('entity duration', entity.get('video#duration'))
  console.log('entity triples', toTriples(entity))
  console.log('entity turtle', toTurtle(entity))
  console.log('entity is video', entity.is('sonar/video'))
  // console.log('type json schema', schema.getType('video').toJSONSchema())
  // const s2 = new Schema()
  // s2.addType(schema.getType('video').toJSONSchema())
  t.end()
})

function toTriples (entity) {
  const triples = []
  for (const type of entity.types()) {
    triples.push([entity.id, 'a', type.address])
  }
  for (const fv of entity.fields()) {
    triples.push([entity.id, fv.field.address, fv.value])
  }
  return triples
}

function toTurtle (entity) {
  const triples = toTriples(entity)
  let str = `<${entity.id}>\n`
  str += triples.map(t => '  ' + t[1] + ' ' + t[2]).join('\n')
  return str
}

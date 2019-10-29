import React from 'react'
import { format } from 'date-fns'

export default function Record (props) {
  const { record, schema } = props

  console.log(record, schema)

  return (
    <div className='sonar-record'>
      {Object.entries(schema.properties).map(([key, fieldSchema], i) => {
        if (typeof record.value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={record.value[key]} />
        )
      })}
    </div>
  )
}

function findWidget (fieldSchema) {
  const { type, format } = fieldSchema
  if (type === 'string' && format === 'date-time') return DateViewer
  if (type === 'string') return TextViewer
  return () => <em>No viewer available for {type}</em>
}

function FieldViewer (props) {
  const { fieldSchema, value } = props
  const Viewer = findWidget(fieldSchema)
  // console.log('field', fieldSchema, value, Viewer)
  return (
    <div className='sonar-record--field'>
      <div className='sonar-record--field-label'>
        {fieldSchema.title}
      </div>
      <div className='sonar-record--field-value'>
        <Viewer value={value} fieldSchema={fieldSchema} />
      </div>
    </div>
  )
}

function TextViewer (props) {
  const { value } = props
  return <strong>{value}</strong>
}

function DateViewer (props) {
  const { value } = props
  const date = new Date(value)
  const formatted = format(date, 'dd.MM.yyyy HH:mm')
  return (
    <span className='sonar--viewer-date'>{formatted}</span>
  )
}

const styles = `
  .sonar-record--field {
    display: flex;
    border-bottom: 1px dotted var(--color-border);
    padding-bottom: 1rem;
    margin-bottom: 1rem;
  }
  .sonar-record--field-label {
    width: 12rem;
    text-align: right;
    margin-right: 1rem;
    color: var(--color-text-secondary);
  }
`

const el = document.createElement('style')
el.appendChild(document.createTextNode(styles))
document.head.appendChild(el)

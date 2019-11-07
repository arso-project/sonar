import React, { useState } from 'react'
import { format, formatRelative } from 'date-fns'
import ReactJson from 'react-json-view'

import './Record.css'

function findWidget (fieldSchema) {
  const { type, format } = fieldSchema
  if (type === 'string' && format === 'date-time') return DateViewer
  if (type === 'string') return TextViewer
  return () => <em>No viewer available for {type}</em>
}

function getDisplays () {
  return [
    { id: 'fields', name: 'Fields', component: RecordFieldDisplay },
    { id: 'json', name: 'JSON', component: RecordJsonDisplay },
    { id: 'label', name: 'Label', component: RecordLabelDisplay }
  ]
}

export function RecordGroup (props) {
  const { records, schemas } = props
  if (!records) return null
  return (
    <div className=''>
      {records.map((record, i) => (
        <Record key={i} record={record} schema={schemas[record.schema]} />
      ))}
    </div>
  )
}

export function Record (props) {
  const { record, schema } = props

  const [displayId, setDisplay] = useState('fields')
  const displays = getDisplays()
  const display = displays.find(d => d.id === displayId)

  const selector = (
    <select value={displayId} onChange={e => setDisplay(e.target.value)}>
      {displays.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  )

  const Display = display.component

  return (
    <div className='sonar-record'>
      {selector}
      <Display record={record} schema={schema} />
      <RecordMeta record={record} schema={schema} />
    </div>
  )
}

export function RecordLabelDisplay (props) {
  const { record, schema } = props
  return (
    <span>{record.value.title || record.id}</span>
  )
}

export function RecordJsonDisplay (props) {
  const { record } = props
  return (
    <ReactJson
      src={record.value}
      name={null}
      displayDataTypes={false}
      displayObjectSize={false}
      enableClipboard={false}
      collapseStringsAfterLength={40}
      collapsed={1}
    />
  )
}

export function RecordFieldDisplay (props) {
  const { record, schema } = props

  if (!schema) return <NoSchemaError record={record} />

  return (
    <div>
      {Object.entries(schema.properties).map(([key, fieldSchema], i) => {
        if (typeof record.value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={record.value[key]} />
        )
      })}
    </div>
  )
}

function FieldViewer (props) {
  const { fieldSchema, value } = props
  const Viewer = findWidget(fieldSchema)
  // console.log('field', fieldSchema, value, Viewer)
  return (
    <div className='sonar-record__field'>
      <div className='sonar-record__field-label'>
        {fieldSchema.title}
      </div>
      <div className='sonar-record__field-value'>
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
    <span className='sonar-viewer-date'>{formatted}</span>
  )
}

function RecordMeta (props) {
  const { record, schema } = props
  const { id, source, meta, schema: schemaName } = record

  return (
    <div className='sonar-record__meta'>
      <dl>
        <div>
          <dt>Schema</dt><dd>{formatSchema(schemaName)}</dd>
        </div>
        <div>
          <dt>ID</dt><dd>{id}</dd>
        </div>
        <div>
          <dt>Source</dt><dd>{formatSource(source)}</dd>
        </div>
        <div>
          <dt>Created</dt><dd>{formatDate(meta.ctime)}</dd>
        </div>
        <div>
          <dt>Modified</dt><dd>{formatDate(meta.mtime)}</dd>
        </div>
      </dl>
    </div>
  )
}

function NoSchemaError (props) {
  const { record } = props
  const { id, schema } = record
  return (
    <div>
      Cannot display record <strong>{id}</strong>: Schema <code>{schema}</code> not found.
    </div>
  )
}

function formatDate (ts) {
  const date = new Date(ts)
  return formatRelative(date, Date.now())
}

// TODO: This is likely too hacky. Propably we'll want
// a full component with a tooltip for details.
function formatSchema (schemaName) {
  return schemaName.split('/').slice(1).join('/')
}

function formatSource (source) {
  return source.substring(0, 6)
}

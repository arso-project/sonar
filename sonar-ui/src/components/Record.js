import React, { useState } from 'react'
import { format, formatRelative } from 'date-fns'
import ReactJson from 'react-json-view'
import { Link } from 'react-router-dom'

import './Record.css'

export function findWidget (fieldSchema) {
  const { type, format } = fieldSchema
  if (type === 'string' && format === 'date-time') return DateViewer
  if (type === 'string' || type === 'integer' || type === 'number') return TextViewer
  if (type === 'boolean') return BooleanViewer
  if (type === 'array') return ArrayViewer
  if (type === 'object') return ObjectViewer
  return () => <em>No viewer available for {type}</em>
}

function getDisplays () {
  return [
    { id: 'fields', name: 'Fields', component: RecordFieldDisplay },
    { id: 'json', name: 'JSON', component: RecordJsonDisplay },
    { id: 'label', name: 'Label', component: RecordLabelDisplay },
    { id: 'raw', name: 'Raw', component: RecordRawDisplay }
  ]
}

export function RecordLink (props) {
  let { record, schema, children } = props
  const { id } = record
  children = children || (
    <RecordLabelDisplay record={record} schema={schema} />
  )
  return (
    <Link to={recordPath(id)}>
      {children}
    </Link>
  )
  function recordPath (id) {
    return '/record/' + id
  }
}

export function RecordGroup (props) {
  const { records, schemas } = props
  if (!records) return null
  return (
    <div className='sonar-record__group'>
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
      <div className='sonar-record__footer'>
        <div className='sonar-record__selector'>
          {selector}
        </div>
        <RecordMeta record={record} schema={schema} />
      </div>
      <Display record={record} schema={schema} />
    </div>
  )
}

export function RecordLabelDisplay (props) {
  const { record } = props
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

export function RecordRawDisplay (props) {
  const { record } = props
  return (
    <pre className='sonar-record__raw'>
      {JSON.stringify(record, null, 2)}
    </pre>
  )
}

export function RecordFieldDisplay (props) {
  const { record, schema } = props

  if (!schema) return <NoSchemaError record={record} message='Schema not found' />
  if (!schema.properties) return <NoSchemaError record={record} message='Invalid schema' />

  return (
    <div>
      {Object.entries(schema.properties).map(([key, fieldSchema], i) => {
        if (typeof record.value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={record.value[key]} fieldName={key} />
        )
      })}
    </div>
  )
}

function ObjectViewer (props) {
  const { value, fieldSchema } = props
  if (!value) return 'no object'
  return (
    <div>
      {Object.entries(fieldSchema.properties).map(([key, fieldSchema], i) => {
        if (typeof value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={value[key]} fieldName={key} />
        )
      })}
    </div>
  )
}

function FieldViewer (props) {
  const { fieldSchema, fieldName, value } = props
  const Viewer = findWidget(fieldSchema)
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

function ArrayViewer (props) {
  const { value, fieldSchema } = props
  if (!value) return <InvalidValueError value={value} fieldSchema={fieldSchema} />
  const Viewer = findWidget(fieldSchema.items)
  return (
    <ul className='sonar-record__array'>
      {value.map((value, i) => (
        <li key={i}>
          <Viewer value={value} fieldSchema={fieldSchema.items} />
        </li>
      ))}
    </ul>
  )
}

function TextViewer (props) {
  const { value } = props
  return value
}

function BooleanViewer (props) {
  const { value } = props
  return value ? 'true' : 'false'
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
  const { id, key, timestamp, schema: schemaName } = record
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
          <dt>Source</dt><dd>{formatSource(key)}</dd>
        </div>
        <div>
          <dt>Created</dt><dd>{formatDate(timestamp)}</dd>
        </div>
      </dl>
    </div>
  )
}

function NoSchemaError (props) {
  const { record } = props
  const { id, schema, message } = record
  return (
    <div>
      Cannot display record <strong>{id}</strong> (schema <code>{schema}</code>): {message}.
    </div>
  )
}

function InvalidValueError (props) {
  const { fieldSchema, value } = props
  return (
    <div>
      Invalid value.
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

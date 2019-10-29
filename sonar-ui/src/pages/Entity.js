import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SearchPage from './Search'
import ReactJson from 'react-json-view'
import { formatRelative } from 'date-fns'

import Record from '../components/Record'

import client from '../lib/client'
import errors from '../lib/error'

async function fetchRecordData (id) {
  const records = await client.get({ id })
  const schemaNames = new Set(records.map(r => r.schema))
  const schemas = {}
  await Promise.all([...schemaNames].map(async name => {
    const schema = await client.getSchema(name)
    schemas[name] = schema
  }))
  return { records, schemas }
}

function useRecordData (id) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchRecordData(id)
      .then(({ records, schemas }) => {
        if (!mounted) return
        setData({ records, schemas })
      })
      .catch(error => errors.push(error))
    return () => (mounted = false)
  }, [id])

  return data
}

export default function EntityPage (props) {
  const { id } = useParams()
  const data = useRecordData(id)

  if (!data) return <em>Loading</em>

  const { records, schemas } = data

  return (
    <div className='sonar-entity'>
      <div>
        {records && records.length && <RecordGroup records={records} schemas={schemas} />}
      </div>
    </div>
  )
}

export function RecordGroup (props) {
  const { records, schemas } = props
  if (!records) return null
  return (
    <div className='sonar-search__list'>
      {records.map((record, i) => (
        <RecordView key={i} record={record} schema={schemas[record.schema]} />
      ))}
    </div>
  )
}

function RecordView (props) {
  const { record, schema } = props
  const { value, id, schema: schemaName, source, meta } = record
  const [raw, setRaw] = useState(false)
  return (
    <div className='sonar-search__item'>
      {value.title && <h3>{value.title}</h3>}
      <div>
        <Record record={record} schema={schema} />
        <button onClick={e => setRaw(raw => !raw)}>
          {raw ? 'Hide JSON' : 'Show JSON'}
        </button>
        {raw && (
          <ReactJson
            src={record.value}
            name={null}
            displayDataTypes={false}
            displayObjectSize={false}
            enableClipboard={false}
            collapseStringsAfterLength={40}
            collapsed={1}
          />
        )}
      </div>
      <div className='sonar-search__meta'>
        <dl>
          <dt>ID</dt><dd>{id}</dd>
          <dt>Schema</dt><dd>{formatSchema(schemaName)}</dd>
          <dt>Source</dt><dd>{formatSource(source)}</dd>
          <dt>Created</dt><dd>{formatDate(meta.ctime)}</dd>
          <dt>Modified</dt><dd>{formatDate(meta.mtime)}</dd>
        </dl>
      </div>
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

import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import SearchPage from './Search'
import ReactJson from 'react-json-view'
import { formatRelative } from 'date-fns'

import client from '../lib/client'
import errors from '../lib/error'

export default function EntityPage (props) {
  const { id } = useParams()
  const [records, setRecords] = useState(null)

  useEffect(() => {
    let mounted = true
    client.get({ id })
      .then(results => mounted && setRecords(results))
      .catch(error => errors.push(error))
    return () => (mounted = false)
  }, [id])

  return (
    <div className='sonar-entity'>
      <div>
        <SearchPage />
      </div>
      <div>
        {records && records.length && <Entity records={records} />}
      </div>
    </div>
  )
}

export function Entity (props) {
  const { records } = props
  if (!records) return null
  return (
    <div className='sonar-search__list'>
      {records.map((row, i) => (
        <Record key={i} row={row} />
      ))}
    </div>
  )
}

function Record (props) {
  const { row } = props
  const { value, id, schema, source, meta } = row
  const [raw, setRaw] = useState(false)
  return (
    <div className='sonar-search__item'>
      {value.title && <h3>{value.title}</h3>}
      <div>
        <button onClick={e => setRaw(raw => !raw)}>
          {raw ? 'Hide JSON' : 'Show JSON'}
        </button>
        {raw && (
          <ReactJson
            src={row.value}
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
          <dt>Schema</dt><dd>{formatSchema(schema)}</dd>
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

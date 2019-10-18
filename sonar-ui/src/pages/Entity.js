import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

import client from '../lib/client'
import errors from '../lib/error'

// import makeGlobalStateHook from '../hooks/make-global-state-hook'
// const useGlobalState = makeGlobalStateHook('search')

export default function EntityPage (props) {
  const { id } = useParams()
  const [records, setRecords] = useState(null)
  console.log('id', id)

  useEffect(() => {
    let mounted = true
    client.get({ id })
      .then(results => mounted && setRecords(results))
      .catch(error => errors.push(error))
    return () => (mounted = false)
  }, [id])

  return (
    <div className='sonar-entity'>
      {records && records.length && <Entity records={records} />}
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
  const { value, id, schema, source } = props.row
  return (
    <div className='sonar-search__item'>
      {value.title && <h3>{value.title}</h3>}
      <div className='sonar-search__meta'>
        <dl>
          <dt>ID</dt><dd>{id}</dd>
          <dt>Schema</dt><dd>{formatSchema(schema)}</dd>
          <dt>Source</dt><dd>{formatSource(source)}</dd>
        </dl>
      </div>
      <div
        className='sonar-search__snippet'
        dangerouslySetInnerHTML={{ __html: value.snippet }}
      />
    </div>
  )
}

// TODO: This is likely too hacky. Propably we'll want
// a full component with a tooltip for details.
function formatSchema (schemaName) {
  return schemaName.split('/').slice(1).join('/')
}

function formatSource (source) {
  return source.substring(0, 6)
}

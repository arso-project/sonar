import React, { useState } from 'react'

import client from '../lib/client'
import errors from '../lib/error'

export default function SearchPage (props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState(null)
  return (
    <div className='sonar-search'>
      <div className='sonar-search__input'>
        <input
          type='text'
          value={search}
          onChange={onInputChange}
          placeholder='Type here to search'
        />
      </div>
      <SearchResults results={results} />
    </div>
  )

  function onInputChange (e) {
    const search = e.target.value
    setSearch(search)
    client.search(search)
      .then(results => setResults(results))
      .catch(error => errors.push(error))
  }
}

export function SearchResults (props) {
  const { results } = props
  if (!results) return null
  // console.log('search results', results)
  return (
    <div className='sonar-search__list'>
      {results.map((row, i) => (
        <SearchResult key={i} row={row} />
      ))}
    </div>
  )
}

function SearchResult (props) {
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

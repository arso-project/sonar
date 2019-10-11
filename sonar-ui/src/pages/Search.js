import React, { useState } from 'react'

import client from '../lib/client'

export default function SearchPage (props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState(null)
  return (
    <div>
      <input type='text' value={search} onChange={onInputChange} />
      <SearchResults results={results} />
    </div>
  )

  async function onInputChange (e) {
    const search = e.target.value
    setSearch(search)
    try {
      const results = await client.search(search)
      setResults(results)
      console.log('results', results)
    } catch (err) {
      console.error('error', err)
    }
  }
}

export function SearchResults (props) {
  const { results } = props
  if (!results) return null
  return (
    <ol>
      {results.map((row, i) => (
        <SearchResult key={i} row={row} />
      ))}
    </ol>
  )
}

function SearchResult (props) {
  const { value, id, source } = props.row
  return (
    <li>
      <div>
        {value.title && <h2>{value.title}</h2>}
        <pre>{JSON.stringify(value)}</pre>
        <em>id: {id} source: {source}</em>
      </div>
    </li>
  )
}

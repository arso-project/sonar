import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

import client from '../lib/client'
import errors from '../lib/error'

import { RecordGroup } from '../components/Record'
import { SearchResultList } from './Search'

// import './Record.css'

export default function RecordPage (props) {
  const { id } = useParams()
  const data = useRecordData(id)
  // const searchResults = useSearchResults()

  if (!data) return <em>Loading</em>

  const { records, schemas } = data

  return (
    <div className='sonar-record-page'>
      <SearchResultList />
      <RecordGroup records={records} schemas={schemas} />
    </div>
  )
}

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

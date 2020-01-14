import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

import {
  Box,
  Flex,
  Text,
  List,
  Input,
  Heading
} from '@chakra-ui/core'

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
    <Flex width='100%'>
      <Box display={['none', 'block']} flexShrink='0' width={[0, '8rem', '12rem']} mr={[0, '2rem']}>
        <SearchResultList />
      </Box>
      <Box flex='1' overflow='auto'>
        <RecordGroup records={records} schemas={schemas} />
      </Box>
    </Flex>
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

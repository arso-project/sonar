import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

import {
  Box,
  Flex
} from '@chakra-ui/core'

import client from '../lib/client'

import useAsync from '../hooks/use-async'
import Logger from '../components/Logger'
import { RecordGroup } from '../components/Record'
import { SearchResultList } from './Search'

async function fetchRecordData (id) {
  const records = await client.get({ id })
  const schemas = await client.getSchemas()
  return { records, schemas }
}

export default function RecordPage (props) {
  const { id } = useParams()
  const { data, error, pending } = useAsync(fetchRecordData, [id], [id])
  if (error || pending) return <Logger error={error} pending={pending} />

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

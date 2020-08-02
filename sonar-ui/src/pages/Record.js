import React from 'react'
import { useParams } from 'react-router-dom'

import {
  Box,
  Flex
} from '@chakra-ui/core'

import { RecordGroup } from '../components/Record'
import { SearchResultList } from './Search'
import useRecords from '../hooks/use-record'

export default function RecordPage (props) {
  const { id } = useParams()
  const data = useRecords(id)
  const { records, types } = data
  return (
    <Flex width='100%'>
      <Box display={['none', 'block']} flexShrink='0' width={[0, '8rem', '12rem']} mr={[0, '2rem']}>
        <SearchResultList />
      </Box>
      <Box flex='1' overflow='auto'>
        <RecordGroup records={records} types={types} />
      </Box>
    </Flex>
  )
}

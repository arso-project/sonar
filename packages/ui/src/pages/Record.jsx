import React from 'react'
import { useParams } from 'react-router-dom'

import {
  Box,
  Flex
} from '@chakra-ui/react'

import { RecordGroup } from '../components/Record'
import { SearchResultList } from './Search'
import { useQuery, useCollection } from '@arsonar/react'

export default function RecordPage (props) {
  const { id } = useParams()
  const { records } = useQuery('records', { id })
  const collection = useCollection()
  if (!collection) return null
  const types = collection.schema.getTypes()
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

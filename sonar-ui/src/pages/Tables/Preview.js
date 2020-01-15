import React from 'react'
import Debug from 'debug'
import {
  Box,
  Heading
} from '@chakra-ui/core'

const debug = Debug('sonar:table')
// import { RecordGroup } from '../../components/Record'

export default function Preview (props) {
  debug('render preview: %o', props)
  const record = props.row || {}
  return (
    <Box px='4' py='2'>
      <Heading fontSize='2xl' mb='4'>Preview</Heading>
      {record.id}
    </Box>
  )
}

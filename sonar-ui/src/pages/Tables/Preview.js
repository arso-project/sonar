import React from 'react'
import Debug from 'debug'
import {
  Box,
  Heading
} from '@chakra-ui/core'

import { Record } from '../../components/Record'

const debug = Debug('sonar:table')

export default function Preview (props) {
  debug('render preview: %o', props)
  const { record, schema } = props
  return (
    <Box px='4' py='2'>
      <Heading fontSize='2xl' mb='4'>Preview</Heading>
      <Record record={record} schema={schema} />
    </Box>
  )
}

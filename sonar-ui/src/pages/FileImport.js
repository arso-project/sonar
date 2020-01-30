import React from 'react'
import config from '../lib/config'
import FileImporter from '../components/FileImporter'

import { Redirect } from 'react-router-dom'

import { Box } from '@chakra-ui/core'

export default function FileImportPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <Box flex='1'>
      <FileImporter/>
    </Box>
  )
}

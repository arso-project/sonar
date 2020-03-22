import React from 'react'
import config from '../lib/config'
import FileImporter from '../components/FileImporter'

import { Redirect } from 'react-router-dom'

import { Box, Text } from '@chakra-ui/core'

export default function StartPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <Box flex='1'>
      <Text color='teal.400' fontSize={['lg', '2xl', '4xl']} my='8' textAlign='center'>
        Hello friend, welcome to Sonar!
      </Text>
    </Box>
  )
}

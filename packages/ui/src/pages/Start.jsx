import React from 'react'
import { Redirect } from 'react-router-dom'
import { Box, Text } from '@chakra-ui/core'
import { useWorkspace } from '@arsonar/react'

export default function StartPage (props) {
  const { config } = useWorkspace()
  if (!config.endpoint) {
    return <Redirect to='/config' />
  }

  return (
    <Box flex='1'>
      <Text color='teal.400' fontSize={['lg', '2xl', '5xl']} my='8' textAlign='center'>
        Hello friend, welcome to Sonar!
      </Text>
    </Box>
  )
}

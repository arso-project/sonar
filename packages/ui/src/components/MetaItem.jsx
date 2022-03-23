import React from 'react'
import { Flex, Stack, Text } from '@chakra-ui/react'

export function MetaItems (props) {
  return <Flex {...props} />
}

export function MetaItem (props) {
  const { name, value, stacked } = props
  return (
    <Stack
      direction={stacked ? 'column' : 'row'}
      spacing={stacked ? 0 : 2}
      mr='4'
      fontSize='xs'
    >
      <Text color='gray.400'>{name}</Text>
      <Text color='gray.600'>{value}</Text>
    </Stack>
  )
}

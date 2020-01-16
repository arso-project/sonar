import React from 'react'
import {
  Box, Flex, Badge, Text, Icon, Image,
  FormControl, FormLabel, Input, FormHelperText
} from '@chakra-ui/core'
import css from '@emotion/css'

// Sample component from airbnb.com
export default function DebugPage () {
  return (
    <>
      <Box maxW='sm'>
        <Flex align='baseline' mt={2}>
          <Badge variantColor='pink'>Plus</Badge>
          <Text
            ml={2}
            textTransform='uppercase'
            fontSize='sm'
            fontWeight='bold'
            color='pink.800'
          >
            Foo bar
          </Text>
        </Flex>
        <Text mt={2} fontSize='xl' fontWeight='semibold' lineHeight='short'>
          Test tatoo
        </Text>
        <Text mt={2}>Yay</Text>
        <Flex mt={2} align='center'>
          <Icon name='star' color='orange.400' />
          <Text ml={1} fontsize='sm'><b>4.84</b> (190)</Text>
        </Flex>
      </Box>
      <Box>
        <FormControl maxW='md'>
          <FormLabel htmlFor='email'>Pubkey</FormLabel>
          <Input type='email' id='email' aria-describedby='email-helper-text' />
          <FormHelperText id='email-helper-text' css={css`color: red`}>
            Invalid key
          </FormHelperText>
        </FormControl>
      </Box>
    </>
  )
}

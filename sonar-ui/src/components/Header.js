import React, { Fragment } from 'react'
import { FaRegListAlt } from 'react-icons/fa'
import {
  ThemeProvider,
  ColorModeProvider,
  Box,
  Flex,
  Heading,
  IconButton,
  Button,
  // Text,
  useColorMode,
  useDisclosure
} from '@chakra-ui/core'

import MobileNav from './MobileNav'
import LogModal from './LogModal'

export default function Header (props) {
  const { colorMode, toggleColorMode } = useColorMode()
  const bg = { light: 'white', dark: 'gray.800' }
  return (
    <Box
      pos='fixed'
      as='header'
      top='0'
      zIndex='4'
      bg={bg[colorMode]}
      left='0'
      right='0'
      borderBottomWidth='1px'
      width='full'
      height='2rem'
      {...props}
    >
      <Flex size='100%' px='4' align='center'>
        <Heading
          fontSize='md'
          color='teal.400'
          letterSpacing='wide'
          mr={2}
          my={1}
          textTransform='uppercase'
        >
        Sonar
        </Heading>

        <Flex flex='1' />
        <LogButton />
        <IconButton
          aria-label={`Switch to ${
            colorMode === 'light' ? 'dark' : 'light'
          } mode`}
          variant='ghost'
          color='current'
          ml='2'
          fontSize='md'
          height='2rem'
          onClick={toggleColorMode}
          icon={colorMode === 'light' ? 'moon' : 'sun'}
        />
        <MobileNav />
      </Flex>
    </Box>
  )
}

function LogButton (props) {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <Fragment>
      <IconButton
        aria-label={'Show log'}
        variant='ghost'
        color='current'
        ml='2'
        fontSize='md'
        height='2rem'
        onClick={onOpen}
        icon={FaRegListAlt}
      />
      <LogModal isOpen={isOpen} onClose={onClose} />
    </Fragment>
  )
}


import React from 'react'
import { HashRouter as Router } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import Status from './components/Status'
import Routes from './Routes'

import theme from './theme'

import {
  ThemeProvider,
  ColorModeProvider,
  CSSReset,
  Box,
  Flex,
  Heading,
  IconButton,
  Text,
  useColorMode
} from '@chakra-ui/core'

export default function App (props) {
  return (
    <Wrappers>
      <Page />
    </Wrappers>
  )
}

function Wrappers (props) {
  return (
    <ThemeProvider theme={theme}>
      <ColorModeProvider>
        <CSSReset />
        <Router>
          {props.children}
        </Router>
      </ColorModeProvider>
    </ThemeProvider>
  )
}

function Page (props) {
  return (
    <Layout>
      <Routes />
    </Layout>
  )
}

function Layout (props) {
  const { children } = props
  return (
    <Box>
      <Header height='2rem' />
      <Sidebar mt='2rem' display={['none', null, 'block']} maxWidth='12rem' width='full' />
      <Box pl={[0, null, '12rem']} mt='2rem'>
        <Box as='main' mx='auto' px='4' py='4' mb='2'>
          {children}
          <Footer />
        </Box>
      </Box>
    </Box>
  )
}

function Header (props) {
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
      </Flex>
    </Box>
  )
}

function Footer (props) {
  return (
    <Box textAlign='center' pt='12' pb='4' fontSize='sm' opacity='0.6' {...props} />
  )
}

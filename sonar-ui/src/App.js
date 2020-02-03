import React, { Fragment } from 'react'
import { HashRouter as Router } from 'react-router-dom'
import { hot } from 'react-hot-loader/root'

import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
// import Status from './components/Status'
import Routes from './Routes'

import createTheme from './theme'
import CSSReset from './components/CSSReset'

// This sets default props on some chakra components.
import './components/chakra'

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

import { FaRegListAlt } from 'react-icons/fa'
import { LogModal } from './components/LogModal'

function App (props) {
  return (
    <Wrappers>
      <Page />
    </Wrappers>
  )
}

export default hot(App)

function Wrappers (props) {
  return (
    <ColorModeProvider>
      <SonarThemeProvider>
        <CSSReset />
        <Router>
          {props.children}
        </Router>
      </SonarThemeProvider>
    </ColorModeProvider>
  )
}

function SonarThemeProvider (props) {
  const { colorMode } = useColorMode()
  const theme = createTheme(colorMode)
  return <ThemeProvider {...props} theme={theme} />
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
      <Box as='main' id='sonar-main' ml={[0, null, '12rem']} mt='2rem' minHeight='calc(100vh - 2rem)' display='flex' p={4}>
        {children}
      </Box>
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

function Footer (props) {
  return (
    <Box textAlign='center' pt='12' pb='4' fontSize='sm' opacity='0.6' {...props} />
  )
}

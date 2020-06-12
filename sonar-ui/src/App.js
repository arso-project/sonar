import React from 'react'
import { HashRouter as Router } from 'react-router-dom'
import { hot } from 'react-hot-loader/root'
import {
  ThemeProvider,
  ColorModeProvider,
  Box,
  useColorMode
} from '@chakra-ui/core'

import Sidebar from './components/Sidebar'
import Routes from './Routes'
import Header from './components/Header'
import CSSReset from './components/CSSReset'
import createTheme from './theme'

// This sets default props on some chakra components.
import './components/chakra'

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

// function Footer (props) {
//   return (
//     <Box textAlign='center' pt='12' pb='4' fontSize='sm' opacity='0.6' {...props} />
//   )
// }

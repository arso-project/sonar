import React from 'react'
import { HashRouter as Router } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import Status from './components/Status'
import Routes from './Routes'

import { ThemeProvider, ColorModeProvider, CSSReset } from '@chakra-ui/core'

export default function App (props) {
  return (
    <Wrappers>
      <div className='sonar-app'>
        <Sidebar />
        <div className='sonar-main'>
          <Routes />
        </div>
        <Status />
      </div>
    </Wrappers>
  )
}

function Wrappers (props) {
  return (
    <ThemeProvider>
      <ColorModeProvider>
        <CSSReset />
        <Router>
          {props.children}
        </Router>
      </ColorModeProvider>
    </ThemeProvider>
  )
}

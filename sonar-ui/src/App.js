import React from 'react'
import { HashRouter as Router } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import Status from './components/Status'
import Routes from './Routes'

export default function App (props) {
  return (
    <Router>
      <div className='sonar-app'>
        <Sidebar />
        <div className='sonar-main'>
          <Routes />
        </div>
        <Status />
      </div>
    </Router>
  )
}

import React from 'react'
import { HashRouter as Router } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import Routes from './Routes'

export default function App (props) {
  return (
    <Router>
      <Sidebar />
      <Routes />
    </Router>
  )
}

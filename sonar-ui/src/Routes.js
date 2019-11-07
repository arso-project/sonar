import React from 'react'
import { Switch, Route } from 'react-router-dom'

import Start from './pages/Start'
import Config from './pages/Config'
import Search from './pages/Search'
import Filebrowser from './pages/Filebrowser'
import RecordPage from './pages/Record'

export default function Pageroutes () {
  return (
    <Switch>
      <Route exact path='/'><Start /></Route>
      <Route path='/search'><Search /></Route>
      <Route path='/config'><Config /></Route>
      <Route path='/filebrowser'><Filebrowser /></Route>
      <Route path='/record/:id'><RecordPage /></Route>
    </Switch>
  )
}

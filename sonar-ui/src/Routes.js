import React from 'react'
import { Switch, Route } from 'react-router-dom'

import Start from './pages/Start'
import Islands from './pages/Islands'
import Config from './pages/Config'

import Activity from './pages/Activity'
import Search from './pages/Search'
import Filebrowser from './pages/Filebrowser'
import RecordPage from './pages/Record'
import TablesPage from './pages/Tables'
import DebugPage from './pages/Debug'
import FileImportPage from './pages/FileImport'

export default function Pageroutes () {
  return (
    <Switch>
      <Route exact path='/'><Start /></Route>
      <Route path='/islands'><Islands /></Route>
      <Route path='/config'><Config /></Route>
      <Route path='/token/:token'><Config /></Route>

      <Route path='/activity'><Activity /></Route>
      <Route path='/search'><Search /></Route>
      <Route path='/fileimport'><FileImportPage /></Route>
      <Route path='/filebrowser'><Filebrowser /></Route>
      <Route path='/record/:id'><RecordPage /></Route>
      <Route path='/tables'><TablesPage /></Route>
      <Route path='/debug'><DebugPage /></Route>
    </Switch>
  )
}

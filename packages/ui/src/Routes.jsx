import React from 'react'
import { Switch, Route } from 'react-router-dom'

import Start from './pages/Start'
import Collections from './pages/Collections'
import Config from './pages/Config'

import Activity from './pages/Activity'
import Search from './pages/Search'
import Filebrowser from './pages/Filebrowser'
import RecordPage from './pages/Record'
import TablesPage from './pages/Tables'
import DebugPage from './pages/Debug'
import FileImportPage from './pages/FileImport'
import TypePage from './pages/TypeSpecs'

export default function Pageroutes () {
  return (
    <Switch>
      <Route exact path='/'>
        <Start />
      </Route>
      <Route path='/collections'>
        <Collections />
      </Route>
      <Route path='/config'>
        <Config />
      </Route>
      <Route path='/login/:accessCode'>
        <Config />
      </Route>

      <Route path='/activity'>
        <Activity />
      </Route>
      <Route path='/search'>
        <Search />
      </Route>
      <Route path='/fileimport'>
        <FileImportPage />
      </Route>
      <Route path='/types'>
        <TypePage />
      </Route>
      <Route path='/filebrowser'>
        <Filebrowser />
      </Route>
      <Route path='/record/:id'>
        <RecordPage />
      </Route>
      <Route path='/tables'>
        <TablesPage />
      </Route>
      <Route path='/debug'>
        <DebugPage />
      </Route>
    </Switch>
  )
}

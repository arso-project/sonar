import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar (props) {
  return (
    <div className='sonar-sidebar'>
      <h2>Sonar</h2>
      <ul>
        <li><NavLink exact to='/'>Start</NavLink></li>
        <li><NavLink to='/search'>Search</NavLink></li>
        <li><NavLink to='/filebrowser'>Filebrowser</NavLink></li>
        <li><NavLink to='/tables'>Tables</NavLink></li>
        <li><NavLink to='/config'>Config</NavLink></li>
      </ul>
    </div>
  )
}

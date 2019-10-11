import React from 'react'
import { Link } from 'react-router-dom'

export default function Sidebar (props) {
  return (
    <div>
      <ul>
        <li><Link to='/'>Start</Link></li>
        <li><Link to='/search'>Search</Link></li>
        <li><Link to='/config'>Config</Link></li>
      </ul>
    </div>
  )
}

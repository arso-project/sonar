import React from 'react'
import config from '../lib/config'

import { Redirect } from 'react-router-dom'

export default function StartPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <div>
      <h1>Hello welcome to Sonar</h1>
    </div>
  )
}

import React from 'react'
import config from '../lib/config'

import { Redirect } from 'react-router-dom'

export default function StartPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <div className='sonar-start'>
      <h1>Hello friend, welcome to Sonar.</h1>
      <p>Here we could have e.g. an overview of stored islands, or onboarding/help text, network/status info, a picture, ...</p>
    </div>
  )
}

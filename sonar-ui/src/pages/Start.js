import React from 'react'
import config from '../lib/config'
import FileImporter from '../components/FileImporter'

import { Redirect } from 'react-router-dom'


export default function StartPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <div className='sonar-start'>
      <FileImporter/>
    </div>
  )
}


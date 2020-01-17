import React from 'react'
import config from '../lib/config'
import FileImportField from '../components/FileImportField'

import { Redirect } from 'react-router-dom'


export default function StartPage (props) {
  if (!config.get('endpoint')) {
    return <Redirect to='/config' />
  }

  return (
    <div className='sonar-start'>
      <FileImportField/>
    </div>
  )
}


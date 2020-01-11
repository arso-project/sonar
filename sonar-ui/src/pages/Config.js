import React from 'react'
import config from '../lib/config'
import { useParams } from 'react-router-dom'
import { formData } from '../lib/form'

import {
  Box,
  Flex,
  Input,
  Button
} from '@chakra-ui/core'

import FormField from '../components/FormField'

export default function ConfigPage (props) {
  let { token } = useParams()
  const endpoint = config.get('endpoint', 'http://localhost:9191/api')
  token = token || config.get('token', '')
  return (
    <div className='sonar-config'>
      <form onSubmit={onSubmit}>
        <FormField name='endpoint' title='API endpoint' defaultValue={endpoint} />
        <FormField name='token' title='API access token' defaultValue={token} />
        <Button type='submit' variantColor='teal'>Save</Button>
      </form>
    </div>
  )

  function onSubmit (e) {
    e.preventDefault()
    const data = formData(e.currentTarget)
    config.set('endpoint', data.endpoint)
    config.set('token', data.token)
    // After config change reload page to re-initialize client.
    // TODO: Maybe support changing the client at runtime and
    // instead rerender within React.
    window.location.reload()
  }
}


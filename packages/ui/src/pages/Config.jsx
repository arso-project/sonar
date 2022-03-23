import React from 'react'
// import config from '../lib/config'
import { useParams } from 'react-router-dom'
import { formData } from '../lib/form'

import { Button } from '@chakra-ui/react'

import { useWorkspace } from '@arsonar/react'

import FormField from '../components/FormField'

export default function ConfigPage (props) {
  const { config, setConfig } = useWorkspace()
  let { accessCode } = useParams()
  console.log(useParams())
  const endpoint = config.url || 'http://localhost:9191/api/v1/default'
  accessCode = accessCode || config.accessCode || ''
  return (
    <div className='sonar-config'>
      <form onSubmit={onSubmit}>
        <FormField name='url' title='API endpoint' defaultValue={endpoint} />
        <FormField
          name='accessCode'
          title='API access code'
          defaultValue={accessCode}
        />
        <Button type='submit'>Save</Button>
      </form>
    </div>
  )

  function onSubmit (e) {
    e.preventDefault()
    const data = formData(e.currentTarget)
    setConfig(data)
    // After config change reload page to re-initialize client.
    // TODO: Maybe support changing the client at runtime and
    // instead rerender within React.
    window.location.reload()
  }
}

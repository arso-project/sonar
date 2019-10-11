import React from 'react'
import config from '../lib/config'
import { formData } from '../lib/form'

export default function ConfigPage (props) {
  const endpoint = config.get('endpoint', 'http://localhost:9191/api')
  console.log('endpoint', endpoint)
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor='endpoint'>Endpoint</label>
      <input name='endpoint' type='text' placeholder='Endpoint' defaultValue={endpoint} />
      <button type='submit'>OK</button>
    </form>
  )

  function onSubmit (e) {
    e.preventDefault()
    const data = formData(e.currentTarget)
    console.log(data)
    config.set('endpoint', data.endpoint)
  }
}

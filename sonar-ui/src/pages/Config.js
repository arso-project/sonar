import React from 'react'
import config from '../lib/config'
import { useParams } from 'react-router-dom'
import { formData } from '../lib/form'

export default function ConfigPage (props) {
  let { token } = useParams()
  const endpoint = config.get('endpoint', 'http://localhost:9191/api')
  const island = config.get('island', 'default')
  token = token || config.get('token', '')
  return (
    <div className='sonar-config'>
      <form onSubmit={onSubmit}>
        <div className='sonar-config__row'>
          <label htmlFor='endpoint'>API endpoint</label>
          <input name='endpoint' type='text' placeholder='Endpoint' defaultValue={endpoint} />
        </div>
        <div className='sonar-config__row'>
          <label htmlFor='token'>API access token</label>
          <input name='token' type='text' placeholder='API access token' defaultValue={token} />
        </div>
        <div className='sonar-config__row'>
          <label htmlFor='island'>Island</label>
          <input name='island' type='text' placeholder='Database' defaultValue={island} />
        </div>
        <div className='sonar-config__row'>
          <button type='submit'>Save</button>
        </div>
      </form>
    </div>
  )

  function onSubmit (e) {
    e.preventDefault()
    const data = formData(e.currentTarget)
    config.set('endpoint', data.endpoint)
    config.set('island', data.island)
    config.set('token', data.token)
    // After config change reload page to re-initialize client.
    // TODO: Maybe support changing the client at runtime and
    // instead rerender within React.
    window.location.reload()
  }
}

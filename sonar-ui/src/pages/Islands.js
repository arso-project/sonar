import React, { useState } from 'react'
// import { useParams } from 'react-router-dom'
import { formData } from '../lib/form'
import useAsync from '../hooks/use-async'
import Error from '../components/Error'
import Loading from '../components/Loading'
import Key from '../components/Key'
import config from '../lib/config'

import client from '../lib/client'

import './Islands.css'

async function loadInfo () {
  return client.info()
}

export default function IslandPage (props) {
  const { data: info, error, reload } = useAsync(loadInfo)
  const [message, setMessage] = useState(null)

  if (!info && !error) return <Loading />
  if (error) return <Error error={error} />
  console.log('info', info)

  const { islands } = info
  const selectedIsland = config.get('island')
  const cls = island => island.key === selectedIsland ? 'selected' : ''

  // let { } = useParams()
  return (
    <div className='sonar-islands sonar-config'>
      <h2>Islands</h2>
      { islands && (
        <ul className='sonar-islands--list'>
          {Object.values(islands).map((island, i) => (
            <li key={i}>
              <h3 onClick={e => onSelectIsland(island)} className={cls(island)}>
                {island.name}
              </h3>
              <div><Key k={island.key} /></div>
              <label>
                  Share:
                <input type='checkbox' checked={island.share} disabled />
              </label>
            </li>
          ))}
        </ul>
      )}
      <h2>Create Island</h2>
      {message}
      <form onSubmit={onCreate}>
        <div className='sonar-config__row'>
          <label htmlFor='name'>Name</label>
          <input name='name' type='text' />
          <button type='submit'>OK</button>
        </div>
      </form>
      <h2>Clone Island</h2>
      <form onSubmit={onCreate}>
        <div className='sonar-config__row'>
          <label htmlFor='name'>Local name</label>
          <input name='name' type='text' />
        </div>
        <div className='sonar-config__row'>
          <label htmlFor='key'>Key</label>
          <input name='key' type='text' />
        </div>
        <div className='sonar-config__row'>
          <button type='submit'>OK</button>
        </div>
      </form>
    </div>
  )

  async function onCreate (e) {
    e.preventDefault()
    // Key may be empty
    let { name, key } = formData(e.currentTarget)
    if (!key || key === '') key = undefined
    if (!name) return setMessage(<strong>Name may not be empty</strong>)
    try {
      const result = await client.createIsland(name, key)
      console.log('result', result)
      setMessage(<strong>Success!</strong>)
    } catch (err) {
      setMessage(<Error error={err} />)
    }
    reload()
  }

  function onSelectIsland (island) {
    config.set('island', island.key)
    window.location.reload()
  }
}

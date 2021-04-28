import React from 'react'

import { useCollection, useRecord, useConfig, useWorkspace, useQuery } from '..'
import './app.css'

export default function App () {
  return (
    <div className='App'>
      <WorkspaceSettings />
      <CollectionPage />
    </div>
  )
}

function CollectionPage () {
  const collection = useCollection(null, { liveUpdates: true })
  const [current, setCurrent] = React.useState(undefined)
  if (!collection) return <em>Loading collection...</em>
  return (
    <>
      <CollectionOverview />
      <button onClick={e => setCurrent(null)}>Create record</button>
      <div className='App-main'>
        <QueryRecords onSelect={path => setCurrent(path)} />
        <EditRecord path={current} />
      </div>
    </>
  )
}

function QueryRecords (props) {
  const { onSelect } = props
  const query = useQuery('records', { type: 'sonar/entity' })
  if (query.pending) return <em>Loading</em>
  if (query.error) return <em>Error: {query.error.message}</em>
  if (!query.records) return <em>No results</em>
  return (
    <ul>
      {query.records.map(record => (
        <ViewRecord key={record.path} path={record.path} onSelect={onSelect} />
      ))}
    </ul>
  )
}

function ViewRecord (props = {}) {
  const { path, onSelect } = props
  const record = useRecord({ path })
  const [version, setVersion] = React.useState(null)
  if (!record) return null
  const current = version || record
  return (
    <div className='ViewRecord'>
      <dl>
        <dt>Type</dt>
        <dd>{current.type}</dd>
        <dt>ID</dt>
        <dd>{current.id}</dd>
        <dt>Address</dt>
        <dd>{current.shortAddress}</dd>
        <dt>Label</dt>
        <dd>{current.get('label')}</dd>
        <dt>Loaded versions</dt>
        <dd>
          Current: <strong>{record.versions().length}</strong>
          &nbsp; All: <em>{record.allVersions().length}</em>
          <div>
            <button onClick={e => setVersion(null)}>latest</button>
            {record.versions().map(version => (
              <button key={version.address} onClick={e => setVersion(version)}>
                {version.shortAddress}
              </button>
            ))}
          </div>
        </dd>
      </dl>
      <button onClick={e => onSelect(record.path)}>Edit</button>
    </div>
  )
}

function EditRecord (props = {}) {
  const { path } = props
  const collection = useCollection()
  const [error, setError] = React.useState(null)
  const current = useRecord({ path })
  if (!collection) return null

  const label = current ? current.get('label') : ''
  const id = current ? current.id : null

  return (
    <form onSubmit={onFormSubmit}>
      <h2>Collection: <em>{collection.label}</em></h2>
      label: <input key={id} name='label' defaultValue={label} type='text' />
      <button type='submit'>save</button>
      {error && <p><strong>Error:</strong>{error.message}</p>}
    </form>
  )

  async function onFormSubmit (e) {
    const data = formDataFromEvent(e)
    const record = {
      type: 'sonar/entity',
      value: data,
      id: current ? current.id : undefined
    }
    try {
      const created = await collection.put(record)
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }
}

function CollectionOverview () {
  const collection = useCollection()
  const [state, setState] = React.useState({})
  if (!collection) return null
  return (
    <div className='CollectionOverview'>
      <h2>{collection.name}</h2>
      <h3>Feeds</h3>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Alias</th>
            <th>Type</th>
            <th>Length</th>
            <th>Writable?</th>
          </tr>
        </thead>
        <tbody>
          {collection.info.feeds.map(feed => (
            <tr key={feed.key}>
              <td><FeedKey keyString={feed.key} /></td>
              <td>{feed.alias}</td>
              <td>{feed.type}</td>
              <td>{feed.length}</td>
              <td>{feed.writable && 'Yes!'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={onAddFeedSubmit}>
        <label htmlFor='keyOrName'>Feed key</label>
        <input name='key' />
        <label htmlFor='alias'>Optional alias</label>
        <input name='alias' />
        <button type='submit'>Add feed</button>
      </form>
      {state.error && <Error error={state.error} />}
      {state.success && <em>Feed added!</em>}
    </div>
  )

  async function onAddFeedSubmit (e) {
    const { key, alias } = formDataFromEvent(e)
    try {
      await collection.putFeed(key, { alias })
      setState({ success: true })
      await collection.open(true)
    } catch (error) {
      setState({ error })
    }
  }
}

function Error (props) {
  const { error } = props
  return (
    <em className='Error'>
      <strong>Error:</strong>{error.message}
    </em>
  )
}

function FeedKey (props) {
  const { keyString } = props
  const [state, setState] = React.useState('idle')
  React.useEffect(() => {
    if (state !== 'idle') {
      const timeout = setTimeout(() => setState('idle'), 2000)
      return () => clearTimeout(timeout)
    }
  }, [state])

  const shortKey = keyString.substring(0, 8) + '..' + keyString.substring(30, 32)
  const className = `FeedKey ${state ? `FeedKey-${state}` : ''}`
  return (
    <span className={className}>
      <code onClick={onClick}>{shortKey}</code>
      {(state === 'copied') && <em>Copied key to clipboard!</em>}
      {(state === 'error') && <em>Could not copy key to clipboard</em>}
    </span>
  )

  function onClick (e) {
    navigator.clipboard.writeText(keyString)
      .then(() => setState('copied'))
      .catch(() => setState('error'))
  }
}

function WorkspaceSettings () {
  const config = useConfig()
  const data = {
    endpoint: config.get('endpoint'),
    accessCode: config.get('accessCode'),
    collection: config.get('collection')
  }
  const key = JSON.stringify(data)
  if (!config) return
  return (
    <form key={key} className='WorkspaceSettings' onSubmit={onFormSubmit}>
      <h2>Workspace settings</h2>
      <section>
        <label htmlFor='endpoint'>Endpoint</label>
        <input defaultValue={data.endpoint} name='endpoint' />
      </section>
      <section>
        <label htmlFor='accessCode'>Access code</label>
        <input defaultValue={data.accessCode} name='accessCode' />
      </section>
      <section>
        <label htmlFor='collection'>Collection</label>
        <input defaultValue={data.collection} name='collection' placeholer='Key or name' />
      </section>
      <section>
        <label htmlFor='collection'>Create collection?</label>
        <input type='checkbox' name='collectionCreate' />
      </section>
      <button type='submit'>save</button>
    </form>
  )

  function onFormSubmit (e) {
    const data = formDataFromEvent(e)
    console.log('set data', data)
    config.set('endpoint', data.endpoint)
    config.set('accessCode', data.accessCode)
    config.set('collection', data.collection)
    location.reload()
  }
}

function formDataFromEvent (e) {
  e.preventDefault()
  const data = {}
  const formData = new FormData(e.target)
  formData.forEach((value, key) => (data[key] = value))
  return data
}


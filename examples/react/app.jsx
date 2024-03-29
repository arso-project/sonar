import React from 'react'
import {
  useCollection,
  useCollectionState,
  useAsync,
  useRecord,
  useQuery,
  useWorkspace,
  WorkspaceProvider
} from '@arsonar/react'
import './app.scss'

export default function App () {
  return (
    <WorkspaceProvider>
      <div className='App'>
        <Header />
        <CollectionPage />
      </div>
    </WorkspaceProvider>
  )
}

function Header () {
  const { collection, pending, error } = useCollectionState({
    liveUpdates: true
  })
  const collectionName = collection ? collection.name : null
  const [showWorkspace, toggleWorkspace] = useToggle(false)
  const [showCollection, toggleCollection] = useToggle(false)
  return (
    <div className='Header'>
      <div className='Header-Bar'>
        <a
          href='#'
          className={showWorkspace ? 'active' : ''}
          onClick={() => toggleWorkspace()}
        >
          Workspace settings
        </a>
        {collection && (
          <a
            href='#'
            className={showCollection ? 'active' : ''}
            onClick={() => toggleCollection()}
          >
            Collection settings
          </a>
        )}
        {pending && <h3>Loading ...</h3>}
        {error && (
          <h3>
            <Error nostyle error={error} />
          </h3>
        )}
        {collectionName && <h3>Collection: {collectionName}</h3>}
      </div>
      {showWorkspace && <WorkspaceSettings />}
      {showCollection && <CollectionOverview />}
    </div>
  )
}

function CollectionPage () {
  const { pending, error } = useCollectionState({ liveUpdates: true, state: true })
  const [currentRecord, setCurrentRecord] = React.useState(undefined)
  const [query, setQuery] = React.useState(null)
  if (error) return <Error error={error} />
  if (pending) return <em>Loading collection...</em>
  return (
    <div className='CollectionPage'>
      <div className='CollectionPage-left'>
        <h2>Query</h2>
        <QueryBuilder query={query} setQuery={setQuery} />
        {query && (
          <QueryRecords
            query={query}
            onSelect={path => setCurrentRecord(path)}
            selected={currentRecord}
          />
        )}
      </div>
      <div className='CollectionPage-right'>
        <button onClick={e => setCurrentRecord(null)}>Create record</button>
        <EditRecord path={currentRecord} />
      </div>
    </div>
  )
}

function QueryBuilder (props) {
  const { query, setQuery } = props
  const [selectedQueryId, setSelectedQueryId] = React.useState('records')

  const queryTypes = [
    { id: 'records', name: 'Records by type', component: RecordsQueryBuilder },
    { id: 'search', name: 'Search', component: SearchQueryBuilder }
  ]
  const queryType = queryTypes.find(
    queryType => queryType.id === selectedQueryId
  )
  const QueryTypeBuilder = queryType && queryType.component

  return (
    <div className='QueryBuilder'>
      <select
        onChange={e => setSelectedQueryId(e.target.value)}
        value={selectedQueryId}
      >
        {queryTypes.map(queryType => (
          <option key={queryType.id} value={queryType.id}>
            {queryType.name}
          </option>
        ))}
      </select>
      {QueryTypeBuilder && (
        <QueryTypeBuilder query={query} setQuery={setQuery} />
      )}
    </div>
  )
}

function RecordsQueryBuilder (props) {
  let { query, setQuery } = props
  if (!query || query.id !== 'records') query = { id: 'records', args: {} }
  const selectedType = query.args.type || null
  return <TypeSelector selected={selectedType} onSelect={onTypeSelect} />
  function onTypeSelect (type) {
    setQuery({ id: 'records', args: { type } })
  }
}

function SearchQueryBuilder (props) {
  let { query, setQuery } = props
  const [inputValue, setInputValue] = React.useState('')
  React.useEffect(() => {
    if (!query || query.id !== 'search') query = { id: 'search', args: '' }
    if (query.args !== inputValue) {
      query.args = inputValue
      setQuery({ ...query })
    }
  }, [inputValue, query])

  return (
    <input
      type='text'
      placeholder='Type to search ...'
      onChange={onInputChange}
      value={inputValue}
    />
  )

  function onInputChange (e) {
    const text = e.target.value
    setInputValue(text)
  }
}

function TypeSelector (props) {
  const { selected, onSelect } = props
  const collection = useCollection()
  const types = React.useMemo(
    () => collection && collection.schema.getTypes(),
    [collection]
  )
  React.useEffect(() => {
    if (!selected && types && types.length) onSelect(types[0].address)
  }, [types])
  if (!types) return null
  return (
    <select
      onChange={e => onSelect(e.target.value)}
      value={selected || undefined}
    >
      {types.map(type => (
        <option key={type.address} value={type.address}>
          {type.title} ({type.address})
        </option>
      ))}
    </select>
  )
}

function QueryRecords (props) {
  const { query: queryProp, onSelect, selected, perPage = 100 } = props
  const query = useQuery(queryProp.id, queryProp.args)
  const [page, setPage] = React.useState(0)
  const pagedRecords = React.useMemo(() => {
    if (!query.records) return null
    if (query.records.length < perPage) return query.records
    const from = page * perPage
    const to = (page + 1) * perPage
    return query.records.slice(from, to)
  }, [query.records, page, perPage])
  if (query.pending) return <em>Loading</em>
  if (query.error) return <em>Error: {query.error.message}</em>
  if (!pagedRecords) return <em>No results</em>
  const numPages = Math.ceil(query.records.length / perPage)
  return (
    <div className='QueryRecords'>
      <div>
        total: {query.records.length}, showing: {pagedRecords.length}, page:
        <select onChange={e => setPage(Number(e.target.value))} value={page}>
          {new Array(numPages).fill(0).map((val, idx) => (
            <option key={idx} value={idx}>
              {idx + 1}
            </option>
          ))}
        </select>
      </div>
      {pagedRecords.map((record, i) => (
        <ViewRecord
          key={i}
          path={record.path}
          onSelect={onSelect}
          selected={selected}
        />
      ))}
    </div>
  )
}

function ViewRecord (props = {}) {
  const { path, selected, onSelect } = props
  const record = useRecord({ path, single: true })
  const [version, setVersion] = React.useState(null)
  if (!record) return null
  const current = version || record
  let className = 'ViewRecord'
  if (selected === path) className += ' ViewRecord-selected'
  return (
    <div className={className}>
      <div className='ViewRecord-fields'>
        {current.fields().map((field, i) => (
          <Row key={i} label={field.title}>
            <FieldValue field={field} />
          </Row>
        ))}
      </div>
      <div className='RecordFooter'>
        <RecordMeta record={current} />
        <div>
          <RecordVersionSelector
            record={record}
            selected={version}
            onSelect={setVersion}
          />
          <a href='#' onClick={e => onSelect(record.path)}>
            Edit
          </a>
        </div>
      </div>
    </div>
  )
}

function RecordMeta (props) {
  const { record } = props
  return (
    <div className='RecordMeta'>
      <div>
        <em>Type: </em>
        <strong>{record.type}</strong>
      </div>
      <div>
        <em>ID: </em>
        <strong>{record.id}</strong>
      </div>
      <div>
        <em>Address: </em>
        <strong>{record.shortAddress}</strong>
      </div>
    </div>
  )
}

function RecordVersionSelector (props) {
  const collection = useCollection()
  const { record, selected, onSelect } = props
  const isSelected = val => (selected === val ? 'selected' : '')
  const latest = record.allVersions().length
  return (
    <div className='RecordVersionSelector'>
      Loaded: &nbsp;{record.allVersions().length}&nbsp;
      {latest > 1 && <span>({latest} latest)&nbsp;</span>}
      <a onClick={e => onSelect(null)} className={isSelected(null)}>
        latest
      </a>
      Latest versions:
      {record.currentVersions().map((version, i) => (
        <a
          key={version.address}
          onClick={e => {
            onSelect(version)
          }}
          className={isSelected(version)}
        >
          {version.shortAddress}
        </a>
      ))}
      <br />
      All versions:
      {record.allVersions().map((version, i) => (
        <div key={i}>
          <a
            key={version.address}
            onClick={e => {
              onSelect(version)
            }}
            className={isSelected(version)}
          >
            {version.shortAddress}
          </a>
          <em>prev: </em>
          {version.links.map((address, i) => (
            <a onClick={e => onVersionClick(address)} key={i}>
              {fmtAddress(address)}
            </a>
          ))}
        </div>
      ))}
    </div>
  )

  function onVersionClick (address) {
    collection.getVersion(address).catch(err => {
      console.error('error loading version: ', err)
    })
  }
}

function Row (props) {
  const { label, children } = props
  return (
    <div className='Row'>
      <div className='Row-label'>{label}</div>
      <div className='Row-content'>{children}</div>
    </div>
  )
}

function FieldValue (props) {
  const { field } = props
  return valueToString(field.value)
}

function fieldValueToString (field, value) {
  if (field.fieldType === 'object') return JSON.stringify(value)
  else return String(value)
}

function stringToFieldValue (field, value) {
  if (field.fieldType === 'object') return JSON.parse(value)
  if (field.fieldType === 'number') return Number(value)
  if (field.fieldType === 'boolean') {
    return value.lowercase() === 'true' || value === '1'
  } else {
    return value
  }
}

function EditRecord (props = {}) {
  const { path } = props
  const collection = useCollection()
  const [submitState, setSubmitState] = React.useState({})
  const current = useRecord({ path })
  const [formState, setFormState] = React.useState({})
  const [selectedTypeAddress, setSelectedTypeAddress] = React.useState(null)
  React.useEffect(() => {
    if (!current) return setFormState({})
    const state = current.fields().reduce((state, field) => {
      state[field.field.name] = fieldValueToString(field.field, field.value)
      return state
    }, {})
    setSubmitState({})
    setFormState(state)
  }, [current, selectedTypeAddress])

  const create = !current
  let fields, type
  if (current) {
    fields = current.fields().map(f => f.field)
    type = current.getType()
    for (const field of type.fields()) {
      if (!fields.find(f => f.address === field.address)) fields.push(field)
    }
  } else if (collection && selectedTypeAddress) {
    type = collection.schema.getType(selectedTypeAddress)
    fields = type.fields()
  }

  if (!collection) return null

  return (
    <form onSubmit={onFormSubmit} className='EditRecord'>
      {create && <h2>Create record</h2>}
      {create && (
        <div>
          Select type:{' '}
          <TypeSelector
            selected={selectedTypeAddress}
            onSelect={setSelectedTypeAddress}
          />
        </div>
      )}
      {!create && <h2>Edit record</h2>}
      {!create && <RecordMeta record={current} />}
      {fields && (
        <div>
          {fields.map((field, i) => (
            <Row key={i} label={field.title}>
              <input
                type='text'
                value={formState[field.name] || ''}
                onChange={e => updateFormState(field.name, e.target.value)}
              />
            </Row>
          ))}
        </div>
      )}
      <button type='submit' disabled={submitState.pending}>
        save
      </button>
      {submitState.error && <Error error={submitState.error} />}
      {submitState.success && (
        <em>Created record: {submitState.success.shortAddress}</em>
      )}
    </form>
  )

  function updateFormState (field, value) {
    setFormState(state => ({ ...state, [field]: value }))
  }

  async function onFormSubmit (e) {
    e.preventDefault()
    setSubmitState({ pending: true })
    const nextValue = fields.reduce((state, field) => {
      state[field.name] = stringToFieldValue(field, formState[field.name])
      return state
    }, {})
    const record = {
      type: type.address,
      value: nextValue,
      id: current ? current.id : undefined
    }
    try {
      const created = await collection.put(record)
      setSubmitState({ success: created })
    } catch (error) {
      setSubmitState({ error })
    }
  }
}

function CollectionOverview () {
  const collection = useCollection()
  const [state, setState] = React.useState({})
  if (!collection) return null
  const headers = ['Key', 'Alias', 'Type', 'Length', 'Writable']
  return (
    <div className='CollectionOverview'>
      <h2>{collection.name}</h2>
      Length: {collection.length}
      <h3>Feeds</h3>
      <table>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {collection.info.feeds.map(feed => (
            <tr key={feed.key}>
              <td>
                <FeedKey keyString={feed.key} />
              </td>
              <td>{feed.alias}</td>
              <td>{feed.type}</td>
              <td>{feed.length}</td>
              <td>{feed.writable && 'Yes!'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={onAddFeedSubmit}>
        <label htmlFor='keyOrName'>Add feed:</label>
        <input name='key' placeholder='Key string ...' />
        <button type='submit' disabled={state.pending}>
          {state.pending ? 'Saving...' : 'Add feed'}
        </button>
      </form>
      {state.error && <Error error={state.error} />}
      {state.success && <em>Feed added!</em>}
    </div>
  )

  async function onAddFeedSubmit (e) {
    const { key, alias } = formDataFromEvent(e)
    setState({ pending: true })
    try {
      await collection.putFeed(key, { alias })
      setState({ success: true })
      await collection.open(true)
    } catch (error) {
      setState({ error })
    }
  }
}

function WorkspaceSettings () {
  const { workspace, config, setConfig } = useWorkspace()
  const [error, setError] = React.useState(null)
  const [create, setCreate] = React.useState(false)

  const {
    data: collections,
    error: workspaceLoadError
  } = useAsync(async () => {
    return await workspace.listCollections()
  }, [workspace])
  const key = JSON.stringify(config)

  if (!config) return null
  return (
    <form key={key} className='WorkspaceSettings' onSubmit={onFormSubmit}>
      <h2>Workspace settings</h2>
      <section>
        <label htmlFor='url'>Workspace URL</label>
        <input defaultValue={config.url} name='url' />
      </section>
      <section>
        <label htmlFor='accessCode'>Access code</label>
        <input defaultValue={config.accessCode} name='accessCode' />
      </section>
      <section>
        {workspaceLoadError && <Error error={workspaceLoadError} />}
        {collections && (
          <>
            <label htmlFor='collection'>Collections</label>
            <select name='collection' defaultValue={config.collection}>
              {Object.values(collections).map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </section>
      <section>
        <label htmlFor='createCollection'>Create collection?</label>
        <input
          type='checkbox'
          onChange={e => setCreate(e.target.value)}
          name='createCollection'
        />
      </section>
      {create && (
        <section>
          <label htmlFor='createCollectionName'>Collection</label>
          <input name='createCollectionName' placeholer='Key or name' />
        </section>
      )}
      <button type='submit'>save</button>
      {error && <Error error={error} />}
    </form>
  )

  async function onFormSubmit (e) {
    const data = formDataFromEvent(e)
    if (data.createCollection) {
      if (!data.createCollectionName) return
      try {
        setConfig({ collection: null })
        const collection = await workspace.createCollection(
          data.createCollectionName
        )
        setConfig({ collection: collection.name })
      } catch (error) {
        setError(error)
      }
    } else {
      const nextConfig = {
        accessCode: data.accessCode,
        url: data.url,
        collection: data.collection
      }
      setConfig(nextConfig)
    }
  }
}

function Error (props) {
  const { error, nostyle } = props
  React.useEffect(() => {
    console.error(error)
  }, [error])
  let message
  if (error && typeof error === 'object') message = error.message
  else message = error
  if (nostyle) return <span>Error: {message}</span>
  return (
    <em className='Error'>
      <strong>Error:</strong> {message}
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

  const shortKey =
    keyString.substring(0, 8) + '..' + keyString.substring(30, 32)
  const className = `FeedKey ${state ? `FeedKey-${state}` : ''}`
  return (
    <span className={className}>
      <code onClick={onClick}>{shortKey}</code>
      {state === 'copied' && <em>Copied key to clipboard!</em>}
      {state === 'error' && <em>Could not copy key to clipboard</em>}
    </span>
  )

  function onClick (e) {
    navigator.clipboard
      .writeText(keyString)
      .then(() => setState('copied'))
      .catch(() => setState('error'))
  }
}

/// Hooks

function useToggle (defaultValue) {
  const [state, setState] = React.useState(defaultValue)
  function toggle () {
    setState(state => !state)
  }
  return [state, toggle, setState]
}

/// Utils

function formDataFromEvent (e) {
  e.preventDefault()
  const data = {}
  const formData = new FormData(e.target)
  formData.forEach((value, key) => (data[key] = value))
  return data
}

function valueToString (value) {
  if (typeof value === 'undefined') return ''
  if (typeof value === 'string' || typeof value === 'number') return value
  return JSON.stringify(value)
}

function fmtAddress (address) {
  const [key, seq] = address.split('@')
  return key.substring(0, 5) + '..' + key.substring(30, 32) + '@' + seq
}

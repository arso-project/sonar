import React from 'react'
import useAsync from './use-async'
import useWorkspace from './use-workspace'
import useConfig from './use-config'

export default function useCollection (name = null, opts = {}) {
  const [_updateCounter, setUpdateCounter] = React.useState(0)
  const workspace = useWorkspace()
  const config = useConfig()
  if (!name) name = config.get('collection')
  const state = useAsync(async () => {
    if (!workspace) return null
    const collection = await workspace.openCollection(name)
    return collection
  }, [workspace, name])

  const collection = state.data
  state.collection = collection

  React.useEffect(() => {
    if (collection && opts.liveUpdates) {
      collection.pullLiveUpdates()
    }
  }, [opts.liveUpdates, collection])

  React.useEffect(() => {
    if (!collection) return
    console.log('setup effect', collection)
    const onevent = () => {
      console.log('ONEVENT')
      setUpdateCounter(i => i + 1)
    }
    collection.on('open', onevent)
    collection.on('update', onevent)
    return () => {
      collection.removeListener('open', onevent)
      collection.removeListener('update', onevent)
    }
  }, [collection])

  if (opts.state) return state
  return state.collection || null
}

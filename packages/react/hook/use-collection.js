import React from 'react'
import useAsync from './use-async'
import useWorkspace from './use-workspace'
import useConfig from './use-config'

export default function useCollection (name = null, opts = {}) {
  const [_updateCounter, setUpdateCounter] = React.useState(0)
  const workspace = useWorkspace(opts.workspace)
  const config = useConfig()
  if (!name) name = config.get('collection')

  const [openCounter, setOpenCounter] = React.useState(0)

  const state = useAsync(async () => {
    if (!workspace) return null
    try {
      const collection = await workspace.openCollection(name)
      return collection
    } catch (err) {
      workspace.on('collection-open', (collection) => {
        if (collection.name !== name) return
        setOpenCounter(i => i + 1)
      })
      throw err
    }
  }, [workspace, name, openCounter])

  const collection = state.data
  state.collection = collection

  React.useEffect(() => {
    if (!collection) return
    if (opts.liveUpdates) {
      collection.pullLiveUpdates()
    }
  }, [opts.liveUpdates, collection])

  React.useEffect(() => {
    if (!collection) return
    const onevent = () => {
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

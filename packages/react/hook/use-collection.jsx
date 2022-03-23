import React from 'react'
import { useAsync, useWorkspace } from '..'

const Context = React.createContext({})

export function CollectionContext (props = {}) {
  const { collection } = props
  const context = React.useMemo(() => {
    return { collection }
  }, [collection])

  return <Context.Provider value={context}>{props.childern}</Context.Provider>
}

/**
 * @returns {Collection}
 */
export function useCollection (props = {}) {
  const { workspace, defaultCollection } = useWorkspace()
  const currentContext = React.useContext(Context)
  const collectionName =
    props.collection || currentContext.collection || defaultCollection
  return useCollectionInner(workspace, collectionName, props)
}

export function useCollectionInner (workspace, collectionName, opts = {}) {
  const { liveUpdates } = opts
  const [updateCounter, setUpdateCounter] = React.useState(0)
  const [openCounter, setOpenCounter] = React.useState(0)
  const state = useAsync(async () => {
    if (!workspace || !collectionName) return null
    try {
      const collection = await workspace.openCollection(collectionName)
      return collection
    } catch (err) {
      workspace.on('collection-open', collection => {
        if (collection.name !== collectionName) return
        setOpenCounter(i => i + 1)
      })
      throw err
    }
  }, [workspace, collectionName, openCounter])

  // console.log('useCollectionInner', state)
  const collection = state.data
  state.collection = collection

  React.useEffect(() => {
    if (!collection || !liveUpdates) return
    collection.pullLiveUpdates()
  }, [liveUpdates, collection])

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
  state.updated = updateCounter

  if (opts.state) return state
  return state.collection || null
}

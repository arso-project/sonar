import React from 'react'
import type { PropsWithChildren } from 'react'
import { useAsync, useWorkspace } from '..'
import type { AsyncState } from './use-async'
import type { Collection, Workspace } from '@arsonar/client'

const Context = React.createContext<CollectionContext>({})

export type MaybeCollection = null | Collection

export type CollectionContextProps = PropsWithChildren<{
  collection?: Collection
}>

export type CollectionContext = {
  collection?: Collection
}

export type AsyncCollectionState = AsyncState<Collection> & {
  collection: MaybeCollection,
  updated: number
}

export function CollectionContext(props: CollectionContextProps = {}) {
  const { collection } = props
  const context = React.useMemo(() => {
    return { collection }
  }, [collection])

  return <Context.Provider value={context}>{props.children}</Context.Provider>
}

export type UseCollectionOpts = {
  state?: boolean,
  collection?: string,
  liveUpdates?: boolean
}

export function useCollection(opts: UseCollectionOpts = {}): MaybeCollection {
  const state = useCollectionState(opts)
  const res: MaybeCollection = state.collection || null
  return res
}

export function useCollectionState(opts: UseCollectionOpts = {}): AsyncCollectionState {
  // typeof opts extends { state: true } ?
  // AsyncCollectionState :
  // MaybeCollection {
  const context = useWorkspace()
  if (!context) throw new Error('May not use useCollection hook outside of a WorkspaceProvider')
  const { workspace, defaultCollection } = context
  const currentContext = React.useContext(Context)
  const collectionName =
    opts.collection || currentContext.collection?.name || defaultCollection || undefined
  const state = useCollectionInner(workspace, collectionName, opts)
  return state
}

export function useCollectionInner
  (workspace: Workspace, collectionName?: string, opts: UseCollectionOpts = {}):
  AsyncCollectionState {
  const { liveUpdates } = opts
  const [updateCounter, setUpdateCounter] = React.useState(0)
  const [openCounter, setOpenCounter] = React.useState(0)
  let state = useAsync<MaybeCollection, [Workspace, string | undefined, number]>(async (workspace, collectionName) => {
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
  const cstate = state as AsyncCollectionState
  cstate.collection = collection

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
  cstate.updated = updateCounter

  return cstate
  // if (opts.state) {
  //   return cstate as any
  // } else {
  //   return (cstate.collection || null) as any
  // }
}

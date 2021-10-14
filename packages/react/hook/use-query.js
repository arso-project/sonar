import React from 'react'
import { useCollection, useAsync } from '..'

export default function useQuery (name, args, opts) {
  const collection = useCollection({ liveUpdates: true })
  const state = useAsync(async () => {
    if (!collection) return null
    const res = await collection.query(name, args, opts)
    return res
  }, [collection, name, JSON.stringify({ args, opts })])
  const lseq = collection && collection.length
  React.useEffect(() => {
    state.refresh()
  }, [lseq])
  state.records = state.data
  return state
}

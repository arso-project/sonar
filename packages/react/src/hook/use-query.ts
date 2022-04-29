import React from 'react'
import { useCollection, useAsync } from '..'
import type { AsyncState } from './use-async'
import type { Record } from '@arsonar/common'

export type QueryState = AsyncState<Record[]> & {
  records?: Record[] | null
}

export default function useQuery (name: string, args: any, opts?: any): QueryState {
  const collection = useCollection({ liveUpdates: true })
  const state: QueryState = useAsync(async (collection, name, args, opts) => {
    if (!collection) return null
    const res = await collection.query(name, args, opts)
    return res
  }, [collection, name, args, opts], [collection, name, JSON.stringify({ args, opts })])
  const lseq = collection && collection.length
  React.useEffect(() => {
    state.refresh()
  }, [lseq])
  state.records = state.data
  return state
}

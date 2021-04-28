import useCollection from './use-collection'
import useAsync from './use-async'

export default function useQuery (name, args, opts) {
  const collection = useCollection()
  const state = useAsync(async () => {
    if (!collection) return null
    const res = await collection.query(name, args, opts)
    return res
  }, [collection, name, JSON.stringify({ args, opts })])
  state.records = state.data
  return state
}

import useAsync from './use-async'
import client from '../lib/client'

export default function useCollection (name) {
  const result = useAsync(async () => {
    if (name) return client.openCollection(name)
    else return client.focusedCollection()
  }, [name])
  result.collection = result.data
  return result
}

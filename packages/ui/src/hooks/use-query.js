import client from '../lib/client'
import useAsync from './use-async'

export default function useQuery (name, args, opts) {
  return useAsync(loadQuery, [name, args, opts], [name, JSON.stringify(args), JSON.stringify(opts)])
}
async function loadQuery (name, args, opts) {
  return client.query(name, args, opts)
}

import client from '../lib/client'
import useAsync from '../hooks/use-async'
import Logger from '../components/Logger'

async function fetchRecordData (id) {
  const records = await client.get({ id })
  const types = await client.getTypes()
  return { records, types }
}

export default function useRecords (id) {
  const { data, error, pending } = useAsync(fetchRecordData, [id], [id])
  if (error || pending) return <Logger error={error} pending={pending} />
  return (data)
}

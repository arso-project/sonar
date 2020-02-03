import client from '../lib/client'
import log from '../lib/log'

async function fetchRecordData (id) {
  const records = await client.get({ id })
  const schemaNames = new Set(records.map(r => r.schema))
  const schemas = {}
  await Promise.all([...schemaNames].map(async name => {
      const schema = await client.getSchema(name)
      schemas[name] = schema
  }))
  return { records, schemas }
}
  
function useRecord (id) {
  const [data, setData] = useState(null)

  useEffect(() => {
      let mounted = true
      fetchRecordData(id)
      .then(({ records, schemas }) => {
          if (!mounted) return
          setData({ records, schemas })
      })
      .catch(error => errors.push(error))
      return () => (mounted = false)
  }, [id])

  return data
}

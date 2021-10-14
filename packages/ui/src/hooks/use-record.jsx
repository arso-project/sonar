import { useCollection, useRecord } from '@arsonar/react'

export default function useRecords (id) {
  const record = useRecord({ id })
  const collection = useCollection()
  const types = collection.schema.getTypes()
  if (!record) return null
  return { types, record }
}

import React from 'react'
import { useAsync, useCollection } from '..'

export function useRecords (props = {}) {
  props.single = false
  return useRecord(props)
}

export default function useRecord (props = {}) {
  let { path, type, id, update, single = true } = props
  if (path) {
    const parts = path.split('/')
    id = parts.pop()
    type = parts.join('/')
  } else {
    path = type + '/' + id
  }
  const collection = useCollection()
  const [_updateCounter, setUpdateCounter] = React.useState(0)
  const state = useAsync(async () => {
    if (!collection) return null
    if (!id || !type) return null
    let record
    if (!update && single) {
      record = collection.store.getRecord(path)
    }
    if (!record) {
      record = await collection.get({ type, id })
      if (!record.length) return null
      if (single) record = record[0]
    }
    return record
  }, [collection, path, update, single])

  const record = state.data
  // if (state.data && state.data.length) record = state.data[0]

  React.useEffect(() => {
    if (!record || !single) return
    return record.subscribe(() => {
      setUpdateCounter(updateCounter => updateCounter + 1)
    })
  }, [record])

  return record
  // if (!record || !record.length) return null
  // return record[0]

  // console.log('useRecord', path, record)
  // if (!record.length) return null
}

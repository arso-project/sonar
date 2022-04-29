import React from 'react'
import { useAsync, useCollection } from '..'
import type { Collection } from '@arsonar/client'
import type { Record } from '@arsonar/common'

export type UseRecordProps = {
  path?: string,
  type?: string,
  id?: string,
  update?: boolean,
  single?: boolean
}

export function useRecords (props: UseRecordProps = {}): Record[] {
  props.single = false
  return useRecord(props as UseRecordProps & { single: false })
}

export default function useRecord (props: UseRecordProps & { single: false }): Record[];
export default function useRecord (props: UseRecordProps & { single: true }): Record | null;
export default function useRecord (props: UseRecordProps): Record | null;
export default function useRecord (props: UseRecordProps = {}): Record | Record[] | null {
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
  const state = useAsync(async (collection: Collection | null, path: string, update: boolean, single: boolean) => {
    if (!collection) return null
    if (!id || !type) return null
    let record
    if (!update && single) {
      record = collection.store!.getRecord(path!)
    }
    if (!record) {
      record = await collection.get({ type, id })
      if (!record.length) return null
      if (single) record = record[0]
    }
    return record
  }, [collection, path, !!update, single])

  const record = state.data
  // if (state.data && state.data.length) record = state.data[0]

  React.useEffect(() => {
    if (!record || !single) return
    return (record as Record).subscribe(() => {
      setUpdateCounter(updateCounter => updateCounter + 1)
    })
  }, [record])

  return record
  // if (!record || !record.length) return null
  // return record[0]

  // console.log('useRecord', path, record)
  // if (!record.length) return null
}

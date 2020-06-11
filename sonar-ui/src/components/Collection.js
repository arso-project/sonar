import React from 'react'
import client from '../lib/client'
import useAsync from '../hooks/use-async'

export function CollectionName (props) {
  const { data: collection, pending, error } = useAsync(() => client.getCurrentCollection())
  if (pending) return <em>Loading</em>
  if (error) return <em>Error</em>
  return <span>{collection.name}</span>
}

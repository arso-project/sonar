import React from 'react'
import { useCollection } from '@arsonar/react'

export function CollectionName (props) {
  const { collection, pending, error } = useCollection({ state: true })
  if (pending) return <em>Loading</em>
  if (error) return <em>Error</em>
  if (!collection) return null
  return <span>{collection.name}</span>
}

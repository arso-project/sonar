import React from 'react'
import client from '../lib/client'
import useAsync from '../hooks/use-async'

export function IslandName (props) {
  const { data: island, pending, error } = useAsync(() => client.getCurrentIsland())
  if (pending) return <em>Loading</em>
  if (error) return <em>Error</em>
  return <span>{island.name}</span>
}

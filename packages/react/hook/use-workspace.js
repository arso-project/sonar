import useConfig from './use-config'
// import React from 'react'
// import { Workspace } from '@arsonar/client'
import Sonar from '@arsonar/client'
const { Workspace } = Sonar

const workspaces = new Map()
window.workspaces = workspaces

export default function useWorkspace (opts = {}) {
  const config = useConfig()
  opts = {
    endpoint: config.get('endpoint'),
    workspace: config.get('workspace') || 'default',
    accessCode: config.get('accessCode'),
    token: config.get('token'),
    ...opts
  }
  const key = JSON.stringify(opts)
  if (!workspaces.has(key)) {
    workspaces.set(key, new Workspace(opts))
  }
  return workspaces.get(key)

  // const workspaceRef = React.useRef()

  // if (!workspaceRef.current) {
  //   workspaceRef.current = new Workspace(opts)
  // }
  // return workspaceRef.current
}

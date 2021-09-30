import useConfig from './use-config'
import { Workspace } from '@arsonar/client'
// const { Workspace } = Sonar

const workspaces = new Map()
window.workspaces = workspaces

export default function useWorkspace (opts = {}) {
  const config = useConfig()
  opts = {
    endpoint: config.get('endpoint'),
    workspace: config.get('workspace') || 'default',
    accessCode: config.get('accessCode'),
    token: config.get('token')
    // ...opts
  }
  const key = JSON.stringify(opts)
  let workspace
  if (!workspaces.has(key)) {
    workspace = new Workspace(opts)
    workspaces.set(key, workspace)
  } else {
    workspace = workspaces.get(key)
  }
  return workspace
}

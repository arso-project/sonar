import React from 'react'
import useConfig from './use-config'
import { Workspace } from '@arsonar/client'

export const workspaces = new Map()

if (typeof window !== 'undefined') {
  window.arsonarWorkspaces = workspaces
}

const Context = React.createContext(null)

export function WorkspaceProvider (props = {}) {
  if (props.appId) props.name = props.appId
  const [config, setConfig] = useConfig(props.appId, props.config)

  const context = React.useMemo(() => {
    return {
      workspace: workspaceFromConfig(config),
      config,
      setConfig,
      defaultCollection: props.collection || config.collection || null
    }
  }, [config])

  return (
    <Context.Provider value={context}>
      {props.children}
    </Context.Provider>
  )
}

export function useWorkspace () {
  return React.useContext(Context)
}

function workspaceFromConfig (config) {
  const base = config.url || config.endpoint + config.workspace
  const key = JSON.stringify([base, config.token || config.accessCode])
  if (!workspaces.has(key)) {
    workspaces.set(key, new Workspace(config))
  }
  return workspaces.get(key)
}

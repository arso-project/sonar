import React, { useMemo } from 'react'
import type { PropsWithChildren } from 'react'
import useConfig from './use-config'
import type { SetConfig } from './use-config'
import { Workspace } from '@arsonar/client'

export const workspaces = new Map()

if (typeof window !== 'undefined') {
  (window as any).arsonarWorkspaces = workspaces
}

const Context = React.createContext<WorkspaceContext>(null)

export type WorkspaceContext = null | {
  workspace: Workspace,
  config: any,
  setConfig: SetConfig
  defaultCollection: string | null
}

export type WorkspaceProviderProps = PropsWithChildren<{
  collection?: string,
  appId?: string,
  name?: string
  config?: any
}>

export function WorkspaceProvider (props: WorkspaceProviderProps = {}) {
  if (props.appId) props.name = props.appId
  const [config, setConfig] = useConfig(props.appId, props.config)

  const context: WorkspaceContext = useMemo(
    () => ({ 
      workspace: workspaceFromConfig(config),
      config,
      setConfig,
      defaultCollection: props.collection || config.collection || null
    }),
   [config]);

  (window as any).__sonarContext = context

  return <Context.Provider value={context}>{props.children}</Context.Provider>
}

export function useWorkspace (): WorkspaceContext {
  return React.useContext(Context)
}

function workspaceFromConfig (config: any) {
  const base = config.url || config.endpoint + config.workspace
  const key = JSON.stringify([base, config.token || config.accessCode])
  if (!workspaces.has(key)) {
    workspaces.set(key, new Workspace(config))
  }
  return workspaces.get(key)
}

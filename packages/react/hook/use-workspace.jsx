import React from 'react'
import useConfig from './use-config'
import { Workspace } from '@arsonar/client'
// const { Workspace } = Sonar

const workspaces = new Map()
window.workspaces = workspaces

const Context = React.createContext(null)

export function WorkspaceContext (props = {}) {
  const [config, setConfig] = useConfig()

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
  // const opts = {
  //   url: config.endpoint,
  //   workspace: config.workspace || name || 'default',
  //   accessCode: config.accessCode,
  //   token: config.token
  // }
  const key = JSON.stringify(config)
  let workspace
  if (!workspaces.has(key)) {
    workspace = new Workspace(config)
    workspaces.set(key, workspace)
  } else {
    workspace = workspaces.get(key)
  }
  return workspace
}

// export default function useWorkspace (name = null) {
//   const config = useConfig()
//   const opts = {
//     endpoint: config.endpoint,
//     workspace: config.workspace || name || 'default',
//     accessCode: config.accessCode,
//     token: config.token
//   }
//   const key = JSON.stringify(opts)
//   let workspace
//   if (!workspaces.has(key)) {
//     workspace = new Workspace(opts)
//     workspaces.set(key, workspace)
//   } else {
//     workspace = workspaces.get(key)
//   }
//   return workspace
// }

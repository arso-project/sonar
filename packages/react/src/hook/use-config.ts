import React from 'react'

export const DEFAULT_KEY = 'arsonar.config'

export const DEFAULT_CONFIG = {
  url: 'http://localhost:9191/api/v1/default'
}

export type Config = any
export type ConfigTable = Record<string, any>
export type SetConfig = (nextConfig: any) => void

type Callback = (data: any) => void
type Listeners = Record<string, Callback[]>

type DefaultValue = (() => any) | any

const config: ConfigTable = {}
const listeners: Listeners = {}

export function load (key: string, defaultValue: DefaultValue) {
  if (!key) throw new Error('Key is required')
  if (config[key] !== undefined) return config[key]

  const data = localStorage.getItem(key)
  if (data) {
    try {
      config[key] = JSON.parse(data)
    } catch (err) {}
  }

  if (config[key] === undefined) {
    if (typeof defaultValue === 'function') {
      defaultValue = defaultValue()
    }
    config[key] = { ...DEFAULT_CONFIG, ...defaultValue }
  }

  return config[key]
}

export function save (key: string, data: any) {
  if (!key) throw new Error('Key is required')
  localStorage.setItem(key, JSON.stringify(data))
  config[key] = data
  if (listeners[key]) listeners[key].forEach(fn => fn(data))
}

export function onchange (fn: Callback, key: string = DEFAULT_KEY) {
  listeners[key] = listeners[key] || []
  listeners[key].push(fn)
  return () => { listeners[key] = listeners[key].filter(l => l !== fn); }
}

export default function useConfig (key = DEFAULT_KEY, defaultValue: DefaultValue = {}): [any, SetConfig] {
  const [state, setState] = React.useState(() => load(key, defaultValue))

  React.useEffect(() => {
    return onchange(data => {
      setState(data)
    })
  }, [key])

  function setConfig (nextData: any) {
    nextData = { ...state, ...nextData }
    save(key, nextData)
  }

  return [state, setConfig]
}

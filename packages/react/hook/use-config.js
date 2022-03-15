import React from 'react'

export const DEFAULT_KEY = 'arsonar.config'

export const DEFAULT_CONFIG = {
  url: 'http://localhost:9191/api/v1/default'
}

const config = {}
const listeners = {}

export function load (key, defaultValue = {}) {
  if (!key) key = DEFAULT_KEY
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

export function save (key, data) {
  console.log('SAVE', { key, data })
  if (!key) key = DEFAULT_KEY
  localStorage.setItem(key, JSON.stringify(data))
  config[key] = data
  if (listeners[key]) listeners[key].forEach(fn => fn(data))
}

export function onchange (fn, key = DEFAULT_KEY) {
  listeners[key] = listeners[key] || []
  listeners[key].push(fn)
  return () => (listeners[key] = listeners[key].filter(l => l !== fn))
}

export default function useConfig (key = DEFAULT_KEY, defaultValue = {}) {
  const [data, setData] = React.useState(() => load(key, defaultValue))

  React.useEffect(() => {
    return onchange((data) => {
      setData(data)
    })
  }, [key])

  function setConfig (nextData) {
    console.log('setConfig', { data, nextData })
    nextData = { ...data, ...nextData }
    save(key, nextData)
  }

  return [data, setConfig]
}

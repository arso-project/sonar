import React from 'react'

export default function useConfig (key = 'arsonar.config') {
  const [config, setConfigState] = React.useState({})
  React.useEffect(() => {
    let data = localStorage.getItem(key)
    if (data) {
      try {
        data = JSON.parse(data)
        setConfigState(data)
      } catch (err) {}
    }
  }, [key])

  function setConfig (nextConfig) {
    nextConfig = { ...config, ...nextConfig }
    console.log('set config', nextConfig)
    localStorage.setItem(key, JSON.stringify(nextConfig))
    setConfigState(nextConfig)
  }

  return [config, setConfig]
}

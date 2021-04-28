import React from 'react'
import { Config } from '../lib/config'

const config = new Config()

export default function useConfig () {
  const [_updateCounter, setUpdateCounter] = React.useState(0)
  React.useEffect(() => {
    const onevent = () => setUpdateCounter(i => i + 1)
    config.on('update', onevent)
    return config.removeListener('update', onevent)
  }, [])
  return config
}

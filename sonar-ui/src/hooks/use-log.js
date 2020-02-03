import logger from '../lib/log'
import { useEffect, useState } from 'react'

export default function useLog () {
  const [log, setLog] = useState([])
  useEffect(() => {
    const unwatch = logger.watch(log => {
      setLog([...log])
    })
    return unwatch
  }, [])
  return log
}
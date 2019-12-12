import React, { useState, useEffect } from 'react'

import errorLogger from '../lib/error'

export default function Status (props) {
  // const { errors } = props
  const errorLog = useErrorLog()
  const lastError = errorLog.length ? errorLog[errorLog.length - 1] : null
  console.log('errorLog', lastError)
  return (
    <div className='sonar-status'>
      <div className='sonar-status__peers'>
      </div>
      <div className='sonar-status__stats'>
      </div>
      <div style={{ flex: 1 }} />
      <div className='sonar-status__errors'>
        {lastError && (
          <strong>{lastError.message}</strong>
        )}
      </div>
    </div>
  )
}

function useErrorLog () {
  const [state, setState] = useState([])
  useEffect(() => {
    const unwatch = errorLogger.watch(log => setState([...log]))
    return unwatch
  }, [])
  return state
}

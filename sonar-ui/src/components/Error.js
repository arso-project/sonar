import React, { useEffect } from 'react'
import errors from '../lib/error'

export default function Error (props) {
  const { error } = props
  useEffect(() => errors.push(error), [error])
  return (
    <div className='sonar-status__errors'>
      {error && (
        <strong>{error.message}</strong>
      )}
    </div>
  )
}

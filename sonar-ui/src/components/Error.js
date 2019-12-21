import React, { useEffect } from 'react'
import errors from '../lib/error'

export default function Error (props) {
  const { error } = props
  useEffect(() => errors.push(error), [error])
  let message
  if (typeof error === 'string') message = error
  else if (typeof error === 'object' && error.message) message = error.message
  else message = JSON.stringify(error)
  return (
    <div className='sonar-status__errors'>
      <strong>{message}</strong>
    </div>
  )
}

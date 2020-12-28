import React from 'react'

export default function Box (props) {
  const { children } = props
  return (
    <div>
      {children}
    </div>
  )
}

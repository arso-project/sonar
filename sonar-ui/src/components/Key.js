import React from 'react'

import './Key.css'

export default function Key (props) {
  const { k: key } = props
  const shortkey = formatKey(key)
  return (
    <span className='sonar-key' onClick={e => copyToClipboard(key)}>
      {shortkey}
    </span>
  )
}

function formatKey (key) {
  return key.substring(0, 6) + '...'
}

const copyToClipboard = str => {
  const el = document.createElement('textarea')
  el.value = str
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

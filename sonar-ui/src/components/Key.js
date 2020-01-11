import React from 'react'
import {
  Text
} from '@chakra-ui/core'

// import './Key.css'

export default function Key (props) {
  const { k: key } = props
  const shortkey = formatKey(key)
  return (
    <Text {...props} onClick={e => copyToClipboard(key)}>
      {shortkey}
    </Text>
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

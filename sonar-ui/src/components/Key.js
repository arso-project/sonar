import React, { useState } from 'react'
import {
  Text,
  Tooltip,
  Flex,
  Icon,
  Box,
  useClipboard,
  Badge
} from '@chakra-ui/core'

// import './Key.css'

export default function Key (props) {
  const { k: key } = props
  const shortkey = formatKey(key)
  const [copyValue, setCopyValue] = useState(key)
  const { value, onCopy, hasCopied } = useClipboard(copyValue)
  // var ttColor
  if (!hasCopied) {
    return (copyClipboardTooltip())
  }
  return (copiedBadge())

  // function copyToClipboard (str) {
  //   const el = document.createElement('textarea')
  //   el.value = str
  //   document.body.appendChild(el)
  //   el.select()
  //   document.execCommand('copy')
  //   document.body.removeChild(el)
  //   // setIsCopied(true)
  //   console.log('Copied!')
  // }

  function copyClipboardTooltip () {
    return (
      <Tooltip
        placement='right-end'
        width='148px'
        label={
          <Flex direction='row' justify='space-between'>
            <Box flex='1'><Icon name='copy' /></Box>
            <Box flex='5'><Text> Copy to clipboard</Text></Box>
          </Flex>
        }
      >
        {/* <Text cursor='copy' onClick={e => copyToClipboard(key)}> */}
        <Text cursor='copy' onClick={onCopy}>
          {shortkey}
        </Text>
      </Tooltip>
    )
  }

  function copiedBadge () {
    return (
      <Flex direction='row' justify='space-between'>
        <Text>{shortkey}</Text>
        <Badge variantColor='green' width='73px'>
          <Flex direction='row' justify='space-around'>
            <Box flex='1'>
              <Icon name='check-circle' />
            </Box>
            <Box flex='2'>Copied</Box>
          </Flex>
        </Badge>
      </Flex>
    )
  }
}

function formatKey (key) {
  return key.substring(0, 6) + '...'
}

import React, { useEffect, useState } from 'react'
import log from '../lib/log'

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from "@chakra-ui/core";


const statuses = {
  error: 'error',
  info: 'info',
}

export default function Logger (props) {
  let { error, info, debug, toast } = props
  const toaster = useToast()
  const [msg, setMsg] = useState(null)
  
  let level
  if (error) level = 'error'
  else if (info) level = 'info'
  else if (debug) level = 'debug'
  
  useEffect(() => {
    const msg = log[level](error || info || debug)
    setMsg(msg)
    if (level !== 'debug' && toast) {
      toaster({
        status: statuses[level],
        title: level,
        description: msg.msg,
        duration: 9000,
        isClosable: true
      })
    }
  }, [error])

  if (!msg) return null
  if (level === 'debug') return null
  if (toast) return null

  return (
    <Alert status={statuses[level]} maxHeight='4rem'>
      <AlertIcon />
      <AlertTitle mr={2}>{level}</AlertTitle>
      <AlertDescription>{msg.msg}</AlertDescription>
    </Alert>
  )
}

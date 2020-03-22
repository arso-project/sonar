import React, { useEffect, useState } from 'react'
import logger from '../lib/log'
import Loading from './Loading'

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/core'

const statuses = {
  error: 'error',
  info: 'info'
}

function StatusMessage (props) {
  const { message } = props
  if (!message) return null
  const { msg, timestamp, level } = message
  return (
    <Alert status={statuses[level]} maxHeight='4rem'>
      <AlertIcon />
      <AlertTitle mr={2}>{level}</AlertTitle>
      <AlertDescription>{msg}</AlertDescription>
    </Alert>
  )
}

export default function Logger (props) {
  const { pending, error, info, debug, toast } = props
  const toaster = useToast()
  const [currentMessage, setCurrentMessage] = useState(null)

  const incomingMessage = error || info || debug

  useEffect(() => {
    if (pending || !incomingMessage) return
    const level = (error && 'error') || (info && 'info') || (debug && 'debug')
    const loggedMessage = logger.log(level, incomingMessage)
    setCurrentMessage(loggedMessage)
    if (level !== 'debug' && toast) {
      toaster({
        status: statuses[level],
        title: level,
        description: loggedMessage.msg,
        duration: 9000,
        isClosable: true
      })
    }
  }, [error])

  if (pending) return <Loading />
  if (!currentMessage) return null
  if (currentMessage.level === 'debug') return null
  if (toast) return null

  return <StatusMessage message={currentMessage} />
}

Logger.Loading = Loading

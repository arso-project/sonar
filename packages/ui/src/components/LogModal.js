import React, { Fragment } from 'react'

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  Button,
  ModalCloseButton,
  List,
  ListItem,
  Text
} from '@chakra-ui/core'
import useLog from '../hooks/use-log'
import { format } from 'date-fns'

export default function LogModal (props) {
  const { isOpen, onClose } = props
  return (
    <Modal isOpen={isOpen} onClose={onClose} scrollBehavior='inside'>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Sonar log</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Log />
        </ModalBody>

        <ModalFooter>
          <Button variantColor='blue' mr={3} onClick={onClose}>
              Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const colors = {
  error: 'red.400',
  debug: 'gray.500',
  info: 'blue.400'
}
export function Log (props) {
  const log = useLog()
  console.log('LOG', log)
  return (
    <List>
      {log.map((msg, i) => (
        <LogMessage key={i} msg={msg} />
      ))}
    </List>
  )
}

function LogMessage (props) {
  const { msg } = props
  return (
    <ListItem display='flex' py='2' borderBottomWidth='1px' alignItems='center'>
      <Text w='10em' fontSize='xs'>
        {format(msg.timestamp, 'Pp')}
      </Text>
      <Text w='4em' color={colors[msg.level]}>{msg.level}</Text>
      <Text flex='1'>
        {msg.msg}
      </Text>
    </ListItem>
  )
}

import React, { useState } from 'react'
// import { useParams } from 'react-router-dom'
import {
  Box,
  Flex,
  Link,
  Alert,
  Input,
  Heading,
  Switch,
  PseudoBox,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useColorMode,
  useToast,
  Collapse,
  Icon
} from '@chakra-ui/core'
import { formData } from '../lib/form'
import useAsync from '../hooks/use-async'
import Logger from '../components/Logger'
import Loading from '../components/Loading'
import Key from '../components/Key'
import config from '../lib/config'
import FormField from '../components/FormField'

import client from '../lib/client'

async function loadInfo () {
  return client.info()
}

export default function IslandPage (props) {
  const { data: info, error, reload } = useAsync(loadInfo)
  const [modal, setModal] = useState(null)

  if (!info && !error) return <Loading />
  if (error) return <Logger error={error} />

  console.log('loaded info', info)

  const { islands } = info
  const selectedIsland = config.get('island')

  return (
    <Flex
      flex='1'
      direction='column'
    >
      <Heading color='teal.400'>Islands</Heading>
      <Flex py='4'>
        <Button mr='4' onClick={() => setModal('create')}>Create new island</Button>
        <Button onClick={() => setModal('add')}>Open existing island</Button>
      </Flex>
      <IslandFormModal isOpen={modal === 'create'} onClose={e => setModal(null)}>
        <CreateIsland create />
      </IslandFormModal>
      <IslandFormModal isOpen={modal === 'add'} onClose={e => setModal(null)}>
        <CreateIsland />
      </IslandFormModal>
      {islands && (
        <IslandList
          islands={islands}
          selected={selectedIsland}
          onSelect={onSelectIsland}
          onUpdate={onUpdateIsland}
        />
      )}
    </Flex>
  )

  function onSelectIsland (key) {
    config.set('island', key)
    window.location.reload()
  }

  function onUpdateIsland (key, info) {
    client.updateIsland(key, info)
  }
}

function FormHeading (props) {
  return (
    <Heading fontSize='md' color='teal.400' {...props} />
  )
}

function Form (props) {
  const { title, children, submitLabel = 'OK', ...other } = props
  return (
    <Box as='form' mb='4' p='2' maxWidth='48rem' {...other}>
      {title && <FormHeading>{title}</FormHeading>}
      {children}
      <Button type='submit' variantColor='teal'>{submitLabel}</Button>
    </Box>
  )
}

function IslandFormModal (props) {
  const { isOpen, onClose, title, children } = props
  return (
    <Modal blockScrollOnMount={false} isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {children}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

function CreateIsland (props) {
  const { create } = props
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  return (
    <Box>
      {create && (
        <Form title='Create island' onSubmit={onCreate}>
          <FormField name='name' title='Local Name' />
          <FormField name='alias' title='Alias' />
        </Form>
      )}
      {!create && (
        <Form title='Clone island' onSubmit={onCreate}>
          <FormField name='name' title='Name' />
          <FormField name='key' title='Key' />
          <FormField name='alias' title='Alias' />
        </Form>
      )}
    </Box>
  )

  async function onCreate (e) {
    e.preventDefault()
    // Key may be empty
    let { name, key, alias } = formData(e.currentTarget)
    if (!key || key === '') key = undefined
    if (!name) return setMessage(<strong>Name may not be empty</strong>)

    client.createIsland(name, { key, alias })
      .then(res => {
        toast({
          title: 'Island created',
          status: 'success'
        })
        if (props.onCreate) props.onCreate()
        setMessage(<strong>Success!</strong>)
      })
      .catch(err => {
        console.log('ERR', err)
        toast({
          title: 'Error',
          description: err.remoteError || err.message,
          status: 'error'
        })
        setMessage(<Error error={err} />)
      })
  }
}

function IslandList (props) {
  const { islands, selected, onSelect, onUpdate } = props
  const { colorMode } = useColorMode()
  const [toggled, setToggled] = useState({})
  function onToggle (key) {
    setToggled(toggled => ({ ...toggled, [key]: !toggled[key] }))
  }

  const selectedBg = { dark: 'gray.700', light: 'gray.100' }

  return (
    <Flex direction='column' mb={4}>
      {Object.values(islands).map((island, i) => (
        <PseudoBox
          key={i}
          borderBottomWidth='1px'
          display={{ md: 'flex' }}
          justify='center'
          p={1}
          bg={island.key === selected ? selectedBg[colorMode] : undefined}
        >
          <Flex
            flex='1'
            direction='column'
          >
            <Flex direction='row' justify='space-between'>
              <Link
                fontSize='md'
                variant='link'
                textAlign='left'
                color='pink.500'
                fontWeight='700'
                onClick={e => onSelect(island.key)}
              >
                {island.name}
              </Link>
              <Flex>
                <FormLabel p='0' mr='2' htmlFor={island.key + '-share'}>
                  Share:
                </FormLabel>
                <Switch
                  size='sm'
                  defaultIsChecked={island.share}
                  id={island.key + '-share'}
                  onChange={e => onUpdate(island.key, { share: !!e.target.checked })}
                />
                <Button size='sm' ml='10' variantColor='blue' onClick={e => onToggle(island.key)}>
                  Info
                  <Icon
                    name={toggled[island.key] ? 'chevron-down' : 'chevron-right'}
                    size='24px'
                  />
                </Button>
              </Flex>
            </Flex>
            <Collapse isOpen={toggled[island.key]}>
              <Flex direction='column' py='2'>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Key:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={island.key} mr='4' />
                  </Box>
                </Flex>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local key:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={island.localKey} mr='4' />
                  </Box>
                </Flex>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local drive:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={island.localDrive} mr='4' />
                  </Box>
                </Flex>
                {island.network.shared && (
                  <Flex direction='row' justify='flex-start'>
                    <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Peers:</Box>
                    <Box style={{ overflowWrap: 'anywhere' }}>
                      {island.network.peers}
                    </Box>
                  </Flex>
                )}
              </Flex>
            </Collapse>
          </Flex>
        </PseudoBox>
      ))}
    </Flex>
  )
}

import React, { useState } from 'react'
// import { useParams } from 'react-router-dom'
import {
  Box,
  Flex,
  Link,
  Heading,
  Switch,
  Button,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useColorMode,
  useToast,
  Collapse,
  Icon
} from '@chakra-ui/react'
import { formData } from '../lib/form'
import Logger from '../components/Logger'
import Loading from '../components/Loading'
import Key from '../components/Key'
import FormField from '../components/FormField'
import { useWorkspace, useAsync } from '@arsonar/react'
import { FaCaretDown, FaCaretRight } from 'react-icons/fa'

function useCollectionList () {
  const { workspace } = useWorkspace()
  return useAsync(async () => {
    return workspace.listCollections()
  }, [workspace])
}

export default function CollectionPage (props) {
  const { config, workspace, setConfig } = useWorkspace()
  const { data: collections, error, refresh } = useCollectionList()
  const [modal, setModal] = useState(null)

  if (!collections && !error) return <Loading />
  if (error) return <Logger error={error} />

  const selectedCollection = config.collection

  return (
    <Flex
      flex='1'
      direction='column'
    >
      <Heading color='teal.400'>Collections</Heading>
      <Flex py='4'>
        <Button mr='4' onClick={() => setModal('create')}>Create new collection</Button>
        <Button onClick={() => setModal('add')}>Open existing collection</Button>
      </Flex>
      <CollectionFormModal isOpen={modal === 'create'} onClose={e => setModal(null)}>
        <CreateCollection create onFinish={onCreate} />
      </CollectionFormModal>
      <CollectionFormModal isOpen={modal === 'add'} onClose={e => setModal(null)}>
        <CreateCollection onFinish={onCreate} />
      </CollectionFormModal>
      {collections && (
        <CollectionList
          collections={collections}
          selected={selectedCollection}
          onSelect={onSelectCollection}
          onUpdate={onUpdateCollection}
        />
      )}
    </Flex>
  )

  function onCreate () {
    setModal(null)
    refresh()
  }

  async function onSelectCollection (key) {
    console.log('select', key)
    try {
      setConfig({ collection: key })
    } catch (err) {
      console.error('Error selecting collection', err)
    }
    // When changing collection we want to reset all state.
    // Instead of using a react context, for now just rerender the whole app.
    window.__sonarRerender()
  }

  async function onUpdateCollection (key, info) {
    await workspace.updateCollection(key, info)
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
    </Box>
  )
}

function CollectionFormModal (props) {
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

function CreateCollection (props) {
  const { workspace } = useWorkspace()
  const { create, onFinish } = props
  const [pending, setPending] = useState(false)
  const toast = useToast()

  return (
    <Box>
      {create && (
        <Form title='Create collection' onSubmit={onCreate}>
          <FormField name='name' title='Local Name' />
          <FormField name='alias' title='Alias' />
          <Button type='submit' disabled={pending} colorScheme='teal'>Create</Button>
        </Form>
      )}
      {!create && (
        <Form title='Clone collection' onSubmit={onCreate}>
          <FormField name='name' title='Name' />
          <FormField name='key' title='Key' />
          <FormField name='alias' title='Alias' />
          <Button type='submit' disaled={pending} colorScheme='teal'>Create</Button>
        </Form>
      )}
    </Box>
  )

  async function onCreate (e) {
    e.preventDefault()
    // Key may be empty
    let { name, key, alias } = formData(e.currentTarget)
    if (!key || key === '') key = undefined
    setPending(true)

    workspace.createCollection(name, { key, alias })
      .then(res => {
        toast({
          title: 'Collection created',
          status: 'success'
        })
        if (props.onFinish) props.onFinish()
        setPending(false)
      })
      .catch(err => {
        toast({
          title: 'Error',
          description: err.remoteError || err.message,
          status: 'error'
        })
        if (props.onFinish) props.onFinish()
        setPending(false)
      })
  }
}

function CollectionList (props) {
  const { collections, selected, onSelect, onUpdate } = props
  const { colorMode } = useColorMode()
  const [toggled, setToggled] = useState({})
  function onToggle (key) {
    setToggled(toggled => ({ ...toggled, [key]: !toggled[key] }))
  }

  const selectedBg = { dark: 'gray.700', light: 'gray.100' }

  return (
    <Flex direction='column' mb={4}>
      {Object.values(collections).map((collection, i) => (
        <Box
          key={i}
          borderBottomWidth='1px'
          display={{ md: 'flex' }}
          justify='center'
          p={1}
          bg={collection.key === selected ? selectedBg[colorMode] : undefined}
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
                onClick={e => onSelect(collection.key)}
              >
                {collection.name}
              </Link>
              <Flex>
                <FormLabel p='0' mr='2' htmlFor={collection.key + '-share'}>
                  Share:
                </FormLabel>
                <Switch
                  size='sm'
                  defaultIsChecked={collection.share}
                  id={collection.key + '-share'}
                  onChange={e => onUpdate(collection.key, { share: !!e.target.checked })}
                />
                <Button size='sm' ml='10' colorScheme='blue' onClick={e => onToggle(collection.key)}>
                  Info
                  {toggled[collection.key] ? <FaCaretDown /> : <FaCaretRight />}
                </Button>
              </Flex>
            </Flex>
            <Collapse isOpen={toggled[collection.key]}>
              <Flex direction='column' py='2'>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Key:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={collection.key} mr='4' />
                  </Box>
                </Flex>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local key:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={collection.localKey} mr='4' />
                  </Box>
                </Flex>
                <Flex direction='row' justify='flex-start'>
                  <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local drive:</Box>
                  <Box style={{ overflowWrap: 'anywhere' }}>
                    <Key k={collection.localDrive} mr='4' />
                  </Box>
                </Flex>
                {collection.network.shared && (
                  <Flex direction='row' justify='flex-start'>
                    <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Peers:</Box>
                    <Box style={{ overflowWrap: 'anywhere' }}>
                      {collection.network.peers}
                    </Box>
                  </Flex>
                )}
              </Flex>
            </Collapse>
          </Flex>
        </Box>
      ))}
    </Flex>
  )
}

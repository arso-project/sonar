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

// import './Groups.css'

async function loadInfo () {
  return client.info()
}

export default function GroupPage (props) {
  const { colorMode } = useColorMode()
  const { data: info, error, reload } = useAsync(loadInfo)
  const [showMoreGroups, setShowMoreGroups] = useState({})

  if (!info && !error) return <Loading />
  if (error) return <Logger error={error} />

  const { groups, network } = info
  const selectedGroup = config.get('group')
  const selectedBg = { dark: 'gray.700', light: 'gray.100' }


  // let { } = useParams()
  // _hover={{ bg: 'gray.50' }}
  return (
    <Flex 
      flex='1'
      direction='column'
    >
      <Heading color='teal.400'>Groups</Heading>
      { groups && (
        <Flex direction='column' mb={4}>
          {Object.values(groups).map((group, i) => (
            <PseudoBox
              key={i}
              borderBottomWidth='1px'
              display={{ md: 'flex' }}
              justify='center'
              p={1}
              bg={group.key === selectedGroup ? selectedBg[colorMode] : undefined}
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
                    onClick={e => onSelectGroup(group)}
                  >
                    {group.name}
                  </Link>
                  <Flex>
                    <FormLabel p='0' mr='2' htmlFor={group.key + '-share'}>
                      Share:
                    </FormLabel>
                    <Switch
                      size='sm'
                      defaultIsChecked={group.share}
                      id={group.key + '-share'}
                      onChange={e => handleShareSwitch(e.target.checked, group)}
                    />
                    <Button size="sm" ml="10" variantColor="blue" onClick={e => handleToggle(group.key)}>
                      Info
                    <Icon
                        name={showMoreGroups[group.key] ? 'chevron-down' : 'chevron-right'}
                        size="24px"
                      />
                    </Button>
                  </Flex>
                </Flex>
                <Collapse isOpen={showMoreGroups[group.key]}>
                  <Flex direction="column" py='2'>
                    <Flex direction="row" justify="flex-start">
                    <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Key:</Box>
                      <Box style={{ overflowWrap: 'anywhere' }}>
                      <Key k={group.key} mr='4' />
                      </Box>
                    </Flex>
                    <Flex direction="row" justify="flex-start">
                    <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local key:</Box>
                    <Box style={{ overflowWrap: 'anywhere' }}>
                      <Key k={group.localKey} mr='4' />
                    </Box>
                    </Flex>
                    <Flex direction="row" justify="flex-start">
                    <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Local drive:</Box>
                    <Box style={{ overflowWrap: 'anywhere' }}>
                                  <Key k={group.localDrive} mr='4' />
                    </Box>
                      </Flex>
                    { getNetworkInfo(group.key) && (
                    <Flex direction="row" justify="flex-start">
                        <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>Peers:</Box>
                        <Box style={{overflowWrap: 'anywhere'}}>
                          {getNetworkInfo(group.key).peers}
                        </Box>
                      </Flex>
                    )
                    }
                  </Flex>
                </Collapse>
              </Flex>
            </PseudoBox>
          ))}
        </Flex>
      )}
      <CreateGroup onCreate={reload} />
    </Flex>
  )

  function onSelectGroup (group) {
    config.set('group', group.key)
    window.location.reload()
  }
  
  function getNetworkInfo (key) {
    return network.shared.find(el => el.key === key)
  }

  function handleShareSwitch (checked, group) {
    client.updateGroup({ 'share': checked }, group.key)
  }

  function handleToggle (key) {
    let newShowMoreGroups = {...showMoreGroups}
    if (showMoreGroups.hasOwnProperty(key)) {
      newShowMoreGroups[key] = !showMoreGroups[key]
    } else {
      newShowMoreGroups[key] = true
    }
    setShowMoreGroups(newShowMoreGroups)
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
      <Button type='submit' variantColor='teal'>OK</Button>
    </Box>
  )
}

function CreateGroup (props) {
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  return (
    <Box>
      <Form title='Create group' onSubmit={onCreate}>
        <FormField name='name' title='Local Name' />
        <FormField name='alias' title='Alias' />
      </Form>
      <Form title='Clone group' onSubmit={onCreate}>
        <FormField name='name' title='Name' />
        <FormField name='key' title='Key' />
        <FormField name='alias' title='Alias' />
      </Form>
    </Box>
  )

  async function onCreate (e) {
    e.preventDefault()
    // Key may be empty
    let { name, key, alias } = formData(e.currentTarget)
    if (!key || key === '') key = undefined
    if (!name) return setMessage(<strong>Name may not be empty</strong>)

    client.createGroup(name, { key, alias })
      .then(res => {
        toast({
          title: 'Group created',
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

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
  useToast
} from '@chakra-ui/core'
import { formData } from '../lib/form'
import useAsync from '../hooks/use-async'
import Error from '../components/Error'
import Loading from '../components/Loading'
import Key from '../components/Key'
import config from '../lib/config'
import FormField from '../components/FormField'

import client from '../lib/client'

// import './Islands.css'

async function loadInfo () {
  return client.info()
}

export default function IslandPage (props) {
  const { data: info, error, reload } = useAsync(loadInfo)

  if (!info && !error) return <Loading />
  if (error) return <Error error={error} />
  console.log('info', info)

  const { islands } = info
  const selectedIsland = config.get('island')
  const cls = island => island.key === selectedIsland ? 'selected' : ''

  // let { } = useParams()
  return (
    <Box>
      <Heading color='teal.400'>Islands</Heading>
      { islands && (
        <Box mb={4}>
          {Object.values(islands).map((island, i) => (
            <PseudoBox
              key={i}
              borderBottomWidth='1px'
              display={{ md: 'flex' }}
              justify='center'
              p={1}
              bg={island.key === selectedIsland ? 'pink.50' : undefined}
              _hover={{ bg: 'gray.50' }}
            >
              <Flex w={['100%', '50%']}>
                <Link
                  fontSize='md'
                  variant='link'
                  textAlign='left'
                  color='pink.500'
                  fontWeight='700'
                  onClick={e => onSelectIsland(island)}
                >
                  {island.name}
                </Link>
              </Flex>
              <Flex flex='1' />
              <Flex justify='center'>
                <Key k={island.key} flex='1' mr='4' />
                <FormLabel p='0' mr='2' htmlFor={island.key + '-share'}>
                  Share:
                </FormLabel>
                <Switch
                  size='sm'
                  defaultIsChecked={island.share}
                  id={island.key + '-share'}
                />
              </Flex>
            </PseudoBox>
          ))}
        </Box>
      )}
      <CreateIsland onCreate={reload} />
    </Box>
  )

  function onSelectIsland (island) {
    config.set('island', island.key)
    window.location.reload()
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

function CreateIsland (props) {
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  return (
    <Box>
      { message && <Alert status='info'>{message}</Alert> }
      <Form title='Create island' onSubmit={onCreate}>
        <FormField name='name' title='Name' />
      </Form>
      <Form title='Clone island' onSubmit={onCreate}>
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

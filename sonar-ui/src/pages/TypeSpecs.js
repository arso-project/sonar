import React, { useState, Suspense } from 'react'
import { MetaItem, MetaItems } from '../components/MetaItem'
import client from '../lib/client'
import useAsync from '../hooks/use-async'
import {
  useDisclosure,
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton
} from '@chakra-ui/core'

async function fetchTypeData () {
  const types = await client.getTypes()
  return { types }
}

function useTypeSpecs () {
  const { data, error, pending } = useAsync(fetchTypeData)
  if (error || pending) return console.log(pending, error)
  const { types } = data
  return (types)
}
function FieldProps (props) {
  const { fields } = props
  return (
    <div>
      <h3>Fields</h3>
      {fields && fields.map((field, i) => {
        return (
          <MetaItems key={i}>
            <MetaItem name='Name:' value={field.name} />
            <MetaItem name='Address:' value={field.address} />
            <MetaItem name='FieldType:' value={field.fieldType} />
            <MetaItem name='defaultWidget:' value={field.defaultWidget} />
          </MetaItems>
        )
      }
      )}
    </div>
  )
}

export default function TypePage (props) {
  const types = useTypeSpecs()
  console.log('TYPES: ', types)
  return (
    <div>
      <h2>Typespecs</h2>
      {types && types.map((type, i) => {
        console.log(type)
        return (
          <Box key={i} m={2} p={4} borderWidth='1px' rounded='lg'>
            <h2>{type.title}</h2>
            <MetaItems>
              <MetaItem stacked name='Namespace' value={type.namespace} />
              <MetaItem stacked name='Name' value={type.title} />
              <MetaItem stacked name='Version' value={type.version} />
              <MetaItem stacked name='Address' value={type.address} />
            </MetaItems>
            <FieldProps fields={type.fields()} />
            <RecordEditor type={type} />
          </Box>
        )
      })}
    </div>

  )
}
function RecordEditor (props) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { type } = props
  return (
    <>
      <Button onClick={onOpen}>New Record</Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{type.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <RecordForm fields={type.fields()} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

function Widgets (props) {
  const [onSubmits, setOnSubmits] = useState({})
  const { fields } = props
  console.log(fields)
  const widgets = {}
  fields.forEach(field => {
    widgets[field.defaultWidget] = React.lazy(() => import('../components/widgets/' + field.defaultWidget))
  })
  return (
    <div>
      {fields && fields.map((field, i) => {
        const Widget = widgets[field.defaultWidget]
        return (
          <div key={i}>
            <Suspense fallback={<div>LOADING</div>}>
              <Widget field={field} register={makeRegister(field.name)} />
            </Suspense>
          </div>
        )
      })}
    </div>
  )
  function makeRegister (name) {
    return function (onSubmit) {
      setOnSubmits(onSubmits => ({ ...onSubmits, [name]: onSubmit }))
    }
  }
}

function RecordForm (props) {
  const { fields } = props
  const [onSubmits, setOnSubmits] = useState({})
  const [data, setData] = useState({})
  return (
    <form onSubmit={onFormSubmit}>
      <Widgets fields={fields} />
      <button variantcolor='blue' mr={3} type='submit'>Submit</button>
      <div>
        submitted:
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>

    </form>
  )
  function onFormSubmit (e) {
    console.log('onsubmit clicked')
    e.preventDefault()
    const data = {}
    for (const [name, onSubmit] of Object.entries(onSubmits)) {
      data[name] = onSubmit()
    }
    setData(data)
  }
}

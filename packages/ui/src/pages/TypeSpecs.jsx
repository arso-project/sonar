import React, { useState, useMemo, useRef, Suspense } from 'react'
import { MetaItem, MetaItems } from '../components/MetaItem'
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
} from '@chakra-ui/react'

import { useCollection } from '@arsonar/react'

function useTypeSpecs () {
  const collection = useCollection()
  if (!collection) return null
  return collection.schema.getTypes()
}

function FieldProps (props) {
  const { fields } = props
  return (
    <div>
      <h3>Fields</h3>
      {fields &&
        fields.map((field, i) => {
          return (
            <MetaItems key={i}>
              <MetaItem name='Name:' value={field.name} />
              <MetaItem name='Address:' value={field.address} />
              <MetaItem name='FieldType:' value={field.fieldType} />
              <MetaItem name='defaultWidget:' value={field.defaultWidget} />
            </MetaItems>
          )
        })}
    </div>
  )
}

export default function TypePage (props) {
  const types = useTypeSpecs()
  console.log('TYPES: ', types)
  return (
    <div>
      <h2>Typespecs</h2>
      {types &&
        types.map((type, i) => {
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

function loadWidget (field) {
  const widgetFileName = field.defaultWidget
  return import('../components/widgets/' + widgetFileName)
}

function FieldWidget (props) {
  const { field, register } = props
  const Widget = React.lazy(() => loadWidget(field))
  return (
    <Suspense fallback={<div>LOADING</div>}>
      <Widget field={field} register={register.bind(null, field.name)} />
    </Suspense>
  )
}

function RecordForm (props) {
  const { fields } = props
  const submitCallbacks = useRef({})
  return (
    <form onSubmit={onFormSubmit}>
      {fields &&
        fields.map((field, i) => (
          <FieldWidget key={i} field={field} register={register} />
        ))}
      <Button variantcolor='blue' mr={3} type='submit'>
        Submit
      </Button>
    </form>
  )

  function onFormSubmit () {
    const data = {}
    for (const [name, onSubmit] of Object.entries(submitCallbacks.current)) {
      data[name] = onSubmit()
    }
    console.log('submit. form data: ', data)
  }

  function register (name, onSubmit) {
    submitCallbacks.current[name] = onSubmit
  }
}

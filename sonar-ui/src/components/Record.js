import React, { useState, useEffect } from 'react'
import { format, formatRelative } from 'date-fns'
import JsonTree from 'react-json-tree'
import { Link } from 'react-router-dom'

import { MetaItem, MetaItems } from '../components/MetaItem'
import client from '../lib/client'
import {
  Box,
  Button,
  List,
  Menu,
  MenuButton,
  MenuList,
  useDisclosure,
  MenuOptionGroup,
  MenuItemOption,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader, DrawerOverlay,
} from '@chakra-ui/core'

// import './Record.css'

export function findWidget(fieldSchema) {
  const { type, format } = fieldSchema
  if (type === 'string' && format === 'date-time') return DateViewer
  if (type === 'string' || type === 'integer' || type === 'number') return TextViewer
  if (type === 'boolean') return BooleanViewer
  if (type === 'array') return ArrayViewer
  if (type === 'object') return ObjectViewer
  return () => <em>No viewer available for {type}</em>
}

function getDisplays() {
  return [
    { id: 'fields', name: 'Fields', component: RecordFieldDisplay },
    { id: 'json', name: 'JSON', component: RecordJsonDisplay },
    { id: 'label', name: 'Label', component: RecordLabelDisplay },
    { id: 'raw', name: 'Raw', component: RecordRawDisplay }
  ]
}

export function RecordLink(props) {
  let { record, schema, children } = props
  const { id } = record
  children = children || (
    <RecordLabelDisplay record={record} schema={schema} />
  )
  return (
    <Link to={recordPath(id)}>
      {children}
    </Link>
  )
  function recordPath(id) {
    return '/record/' + id
  }
}

export function RecordGroup(props) {
  const { records, schemas } = props
  if (!records) return null
  return (
    <Box>
      {records.map((record, i) => (
        <Record key={i} record={record} schema={schemas[record.schema]} />
      ))}
    </Box>
  )
}

function DisplayMenu(props) {
  const { displays, onChange, value } = props
  const active = displays.find(d => d.id === value)
  return (
    <Menu>
      <MenuButton as={Button} rightIcon='chevron-down'>
        {active.name}
      </MenuButton>
      <MenuList>
        <MenuOptionGroup type='radio' onChange={onChange} value={value}>
          {displays.map(display => (
            <MenuItemOption key={display.id} value={display.id}>{display.name}</MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  )
}

export function Record(props) {
  const { record, schema } = props
  const [displayId, setDisplay] = useState('fields')
  const displays = getDisplays()
  const display = displays.find(d => d.id === displayId)
  const Display = display.component

  return (
    <div className='sonar-record' flex={1}>
      <Box display={['block', 'flex']}>
        <RecordMeta record={record} schema={schema} />
        <Box flex={1} />
        <DisplayMenu displays={displays} onChange={setDisplay} value={display.id} />
      </Box>
      <Display record={record} schema={schema} />
    </div>
  )
}

export function RecordLabelDisplay(props) {
  const { record } = props
  return (
    <span>{record.value.title || record.id}</span>
  )
}

export function RecordJsonDisplay(props) {
  const { record } = props
  return (
    <JsonTree
      data={record}
      invertTheme
      hideRoot
      theme='bright'
      shouldExpandNode={(keyName, data, level) => level < 1}
    />
  )
}

export function RecordRawDisplay(props) {
  const { record } = props
  return (
    <Box fontFamily='mono' whiteSpace='pre-wrap'>
      {JSON.stringify(record, null, 2)}
    </Box>
  )
}

export function RecordFieldDisplay(props) {
  const { record, schema } = props

  if (!schema) return <NoSchemaError record={record} message='Schema not found' />
  if (!schema.properties) return <NoSchemaError record={record} message='Invalid schema' />

  return (
    <Box>
      {Object.entries(schema.properties).map(([key, fieldSchema], i) => {
        if (typeof record.value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={record.value[key]} fieldName={key} />
        )
      })}
    </Box>
  )
}

export function RecordDrawerByID(props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();
  const { id } = props
  const data = useRecordData(id)
  if (!data) return <em>Loading</em>
  const { records, schemas } = data
  return (<>
    <Button ml={3} leftIcon="view" variantColor="teal" size="xs"  ref={btnRef} onClick={onOpen}>
      {id}
    </Button>
    <Drawer
      isOpen={isOpen}
      placement="right"
      size="lg"
      onClose={onClose}
      finalFocusRef={btnRef}
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>{id}</DrawerHeader>

        <DrawerBody>
          <RecordGroup records={records} schemas={schemas} ></RecordGroup>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
            </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>
  )
}


function ObjectViewer(props) {
  const { value, fieldSchema } = props
  if (!value) return 'no object'
  return (
    <div>
      {Object.entries(fieldSchema.properties).map(([key, fieldSchema], i) => {
        if (typeof value[key] === 'undefined') return null
        return (
          <FieldViewer key={i} fieldSchema={fieldSchema} value={value[key]} fieldName={key} />
        )
      })}
    </div>
  )
}

function FieldViewer(props) {
  const { fieldSchema, fieldName, value } = props
  const Viewer = findWidget(fieldSchema)
  return (
    <Box display={['block', 'flex']} borderBottomWidth='1px' py='2'>
      <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>{fieldSchema.title}</Box>
      <Box flex='1' style={{ overflowWrap: 'anywhere' }}>
        <Viewer value={value} fieldSchema={fieldSchema} />
      </Box>
    </Box>
  )
}

function ArrayViewer(props) {
  const { value, fieldSchema } = props
  if (!value) return <InvalidValueError value={value} fieldSchema={fieldSchema} />
  if (!Array.isArray(value)) return <InvalidValueError value={value} fieldSchena={fieldSchema} message='Not an array' />
  const Viewer = findWidget(fieldSchema.items)
  return (
    <List>
      {value.map((value, i) => (
        <Box as='li' key={i}>
          <Viewer value={value} fieldSchema={fieldSchema.items} />
        </Box>
      ))}
    </List>
  )
}

function TextViewer(props) {
  const { value } = props
  if (typeof value === 'undefined') return null
  return String(value)
}

function BooleanViewer(props) {
  const { value } = props
  return value ? 'true' : 'false'
}

function DateViewer(props) {
  const { value } = props
  if (!value) return <InvalidValueError />
  const date = new Date(value)
  if (!date) return <InvalidValueError />
  const formatted = format(date, 'dd.MM.yyyy HH:mm')
  return (
    <span className='sonar-viewer-date'>{formatted}</span>
  )
}

function RecordMeta(props) {
  const { record, schema } = props
  const { id, key, timestamp, schema: schemaName } = record
  return (
    <MetaItems>
      <MetaItem stacked name='Schema' value={formatSchema(schemaName)} />
      <MetaItem stacked name='ID' value={id} />
      <MetaItem stacked name='Source' value={formatSource(key)} />
      <MetaItem stacked name='Created' value={formatDate(timestamp)} />
    </MetaItems>
  )
}

function NoSchemaError(props) {
  const { record } = props
  const { id, schema, message } = record
  return (
    <div>
      Cannot display record <strong>{id}</strong> (schema <code>{schema}</code>): {message}.
    </div>
  )
}

function InvalidValueError(props) {
  const { fieldSchema, value } = props
  return (
    <div>
      Invalid value.
    </div>
  )
}

function formatDate(ts) {
  const date = new Date(ts)
  return formatRelative(date, Date.now())
}

// TODO: This is likely too hacky. Propably we'll want
// a full component with a tooltip for details.
function formatSchema(schemaName) {
  return schemaName.split('/').slice(1).join('/')
}

function formatSource(source) {
  return source.substring(0, 6)
}

async function fetchRecordData(id) {
  const records = await client.get({ id })
  const schemaNames = new Set(records.map(r => r.schema))
  const schemas = {}
  await Promise.all([...schemaNames].map(async name => {
    const schema = await client.getSchema(name)
    schemas[name] = schema
  }))
  return { records, schemas }
}

function useRecordData(id) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    fetchRecordData(id)
      .then(({ records, schemas }) => {
        if (!mounted) return
        setData({ records, schemas })
      })
      .catch(error => console.log(error))
    return () => (mounted = false)
  }, [id])

  return data
}
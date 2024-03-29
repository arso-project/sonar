import { format, formatRelative } from 'date-fns'
import JsonTree from 'react-json-tree'
import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import { MetaItem, MetaItems } from '../components/MetaItem'
import { FaCaretDown } from 'react-icons/fa'
import {
  Box,
  Button,
  List,
  Heading,
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
  DrawerHeader,
  DrawerOverlay
} from '@chakra-ui/react'
import { useCollection, useRecord } from '@arsonar/react'

// import './Record.css'

export function findWidget (field) {
  const { fieldType: type, format, address } = field
  if (type === 'string' && address === 'sonar/resource@0#contentUrl')
    return LinkViewer
  if (type === 'string' && format === 'date-time') return DateViewer
  if (type === 'string' && format === 'uri') return LinkViewer
  if (type === 'string' || type === 'integer' || type === 'number')
    return TextViewer
  if (type === 'relation') return RelationViewer
  if (type === 'boolean') return BooleanViewer
  if (type === 'array') return ArrayViewer
  if (type === 'object') return ObjectViewer
  return () => <em>No viewer available for {type}</em>
}
/* collection.schema,
oder über einen Record  */
function getDisplays () {
  return [
    { id: 'fields', name: 'Fields', component: RecordFieldDisplay },
    { id: 'json', name: 'JSON', component: RecordJsonDisplay },
    { id: 'label', name: 'Label', component: RecordLabelDisplay },
    { id: 'raw', name: 'Raw', component: RecordRawDisplay }
  ]
}

export function RecordLink (props) {
  let { record, id, children } = props
  if (record) {
    id = record.id
    children = children || <RecordLabelDisplay record={record} />
  } else if (id) {
    children = children || id
  } else return null

  return <Link to={recordPath(id)}>{children}</Link>
  function recordPath (id) {
    return '/record/' + id
  }
}

export function RecordGroup (props) {
  const { records, types } = props
  if (!records) return null
  return (
    <Box>
      {records.map((record, i) => (
        <Record key={i} record={record} type={types[record.type]} />
      ))}
    </Box>
  )
}

function DisplayMenu (props) {
  const { displays, onChange, value } = props
  const active = displays.find(d => d.id === value)
  return (
    <Menu>
      <MenuButton as={Button} rightIcon={<FaCaretDown />}>
        {active.name}
      </MenuButton>
      <MenuList>
        <MenuOptionGroup type='radio' onChange={onChange} value={value}>
          {displays.map(display => (
            <MenuItemOption key={display.id} value={display.id}>
              {display.name}
            </MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  )
}

export function Record (props) {
  const { record, type } = props
  const [displayId, setDisplay] = useState('fields')
  const displays = getDisplays()
  const display = displays.find(d => d.id === displayId)
  const Display = display.component

  return (
    <Box className='sonar-record' mb='4' flex={1}>
      <Heading size='md' mt='2' mb='2'>
        {record.getType().title}
      </Heading>
      <Box display={['block', 'flex']}>
        <RecordMeta record={record} type={type} />
        <Box flex={1} />
        <DisplayMenu
          displays={displays}
          onChange={setDisplay}
          value={display.id}
        />
      </Box>
      <Display record={record} type={type} />
    </Box>
  )
}

export function RecordLabelDisplay (props) {
  const { record } = props
  const label = findLabel(record)
  return <span>{label}</span>
}

function findLabel (record) {
  return (
    record.getOne('sonar/entity#label') ||
    record.value.title ||
    record.value.name ||
    record.value.filename ||
    record.id
  )
}

export function RecordJsonDisplay (props) {
  const { record } = props
  return (
    <JsonTree
      data={record.latest.toJSON()}
      invertTheme
      hideRoot
      theme='bright'
      shouldExpandNode={(keyName, data, level) => level < 1}
    />
  )
}

export function RecordRawDisplay (props) {
  const { record } = props
  return (
    <Box fontFamily='mono' whiteSpace='pre-wrap'>
      {JSON.stringify(record, null, 2)}
    </Box>
  )
}

export function RecordFieldDisplay (props) {
  const { record } = props
  const collection = useCollection()
  const type = record.getType()
  if (!collection) return null

  if (!type) return <NoTypeError record={record} message='type not found' />
  console.log('RECORD', record)
  return (
    <Box>
      {record.fields().map((fieldValue, i) => (
        <FieldViewer key={i} fieldValue={fieldValue} />
      ))}
    </Box>
  )
}

export function RecordDrawerByID (props) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const collection = useCollection()
  const btnRef = React.useRef()
  const { id } = props
  const record = useRecord({ id })
  console.log('useRecord res', id, record)
  if (!collection || !record) return null
  const records = [record]
  const types = collection.schema.getTypes()
  return (
    <>
      <Button
        w='14rem'
        pl='3'
        leftIcon='view'
        justifyContent='left'
        colorScheme='teal'
        size='xs'
        ref={btnRef}
        onClick={onOpen}
      >
        {id}
      </Button>
      <Drawer
        isOpen={isOpen}
        placement='right'
        size='lg'
        onClose={onClose}
        finalFocusRef={btnRef}
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>{id}</DrawerHeader>
          <DrawerBody>
            <RecordGroup records={records} types={types} />
          </DrawerBody>
          <DrawerFooter>
            <Button variant='outline' mr={3} onClick={onClose}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function ObjectViewer (props) {
  const { value, fieldType } = props
  return <JsonTree data={value} invertTheme hideRoot theme='bright' />
  // const { value, fieldType } = props
  // if (!value) return 'no object'
  // return (
  //   <div>
  //     {Object.entries(fieldType.properties).map(([key, fieldType], i) => {
  //       if (typeof value[key] === 'undefined') return null
  //       return (
  //         <FieldViewer key={i} fieldType={fieldType} value={value[key]} fieldName={key} />
  //       )
  //     })}
  //   </div>
  // )
}

function FieldViewer (props) {
  const { fieldValue } = props
  const Viewer = findWidget(fieldValue.field)
  return (
    <Box display={['block', 'flex']} borderBottomWidth='1px' py='2'>
      <Box flexShrink='0' width={['auto', '12rem']} color='teal.400'>
        {fieldValue.field.title}
      </Box>
      <Box flex='1' style={{ overflowWrap: 'anywhere' }}>
        <Viewer value={fieldValue.value} field={fieldValue.field} />
      </Box>
    </Box>
  )
}
// TODO: Fix array viewer, use multiple prop
function ArrayViewer (props) {
  const { value, field } = props
  if (!value) return <InvalidValueError value={value} field={field} />
  if (!Array.isArray(value))
    return (
      <InvalidValueError value={value} field={field} message='Not an array' />
    )
  const Viewer = findWidget(field)
  return (
    <List>
      {value.map((value, i) => (
        <Box as='li' key={i}>
          <Viewer value={value} fieldType={field} />
        </Box>
      ))}
    </List>
  )
}

function TextViewer (props) {
  const { value } = props
  if (typeof value === 'undefined') return null
  return String(value)
}

function LinkViewer (props) {
  const { value } = props
  const collection = useCollection()
  if (typeof value === 'undefined' || !collection) return null
  const httpLink = collection.fs.resolveURL(String(value))
  return <a href={httpLink}>{httpLink}</a>
}

function RelationViewer (props) {
  const { value } = props
  if (typeof value === 'undefined') return null
  // if (!Array.isArray(value)) value = []
  const id = value
  return <RecordLink id={id} />
}

function BooleanViewer (props) {
  const { value } = props
  return value ? 'true' : 'false'
}

function DateViewer (props) {
  const { value } = props
  if (!value) return <InvalidValueError />
  const date = new Date(value)
  if (!date) return <InvalidValueError />
  const formatted = format(date, 'dd.MM.yyyy HH:mm')
  return <span className='sonar-viewer-date'>{formatted}</span>
}

function RecordMeta (props) {
  const { record } = props
  const { id, key, timestamp, type } = record
  return (
    <MetaItems>
      <MetaItem stacked name='Type' value={formatType(type)} />
      <MetaItem stacked name='ID' value={id} />
      <MetaItem stacked name='Source' value={formatSource(key)} />
      <MetaItem stacked name='Created' value={formatDate(timestamp)} />
    </MetaItems>
  )
}

function NoTypeError (props) {
  const { record } = props
  const { id, type, message } = record
  return (
    <div>
      Missing type for record <strong>{id}</strong> (type <code>{type}</code>):{' '}
      {message}.
    </div>
  )
}

function InvalidValueError (props) {
  return <div>Invalid value.</div>
}

function MissingRecordError (props) {
  return <div>No record</div>
}

function formatDate (ts) {
  if (!ts) return null
  const date = new Date(ts)
  return formatRelative(date, Date.now())
}

// TODO: This is likely too hacky. Propably we'll want
// a full component with a tooltip for details.
function formatType (typeName) {
  return typeName
    .split('/')
    .slice(1)
    .join('/')
}

function formatSource (source) {
  return source.substring(0, 6)
}

// TODO: This is hacky and should not be here.
// async function fetchFileUrls (records) {
//   for (const record of records) {
//     record.value.fileUrl = client.resolveURL(record)
//   }
//   return records
// }

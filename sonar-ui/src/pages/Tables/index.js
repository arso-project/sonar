import React, { useState, useEffect, useMemo, useCallback } from 'react'
import client from '../../lib/client'
import log from '../../lib/log'
import { findWidget, RecordLink } from '../../components/Record'
import makeGlobalStateHook from '../../hooks/make-global-state-hook'

import Table from './Table'
import Preview from './Preview'

import {
  Box,
  Flex,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuOptionGroup,
  MenuItemOption
} from '@chakra-ui/core'

async function loadSchemas () {
  const schemas = await client.getSchemas()
  return Object.values(schemas)
}

async function loadRecords ({ schema }) {
  return client.query('records', { type: schema })
}

const useGlobalState = makeGlobalStateHook('tables')

export default function TablesPage (props) {
  const [records, setRecords] = useGlobalState('records', null)
  const [schema, setSchema] = useGlobalState('schema', null)
  const schemaname = schema ? schema.address : null

  useEffect(() => {
    if (!schemaname) return
    loadRecords({ schema: schemaname })
      .then(records => setRecords(records))
      .catch(log => log.error(error))
  }, [schemaname])

  const rows = useMemo(() => buildRowsFromRecords(records), [records])
  const columns = useMemo(() => buildColumnsFromSchema(schema), [schema])

  const PreviewWrapper = useCallback(function PreviewWrapper (props) {
    const { row } = props
    return <Preview record={row} schema={schema} />
  }, [schema])

  return (
    <Flex direction='column' width='100%'>
      <SchemaSelect onSchema={setSchema} schema={schema} flex={0} />
      {columns && rows && (
        <Table
          columns={columns}
          rows={rows}
          Preview={PreviewWrapper}
        />
      )}
    </Flex>
  )
}

function buildRowsFromRecords (records) {
  if (!records) return null
  return [...records]
}

function buildColumnsFromSchema (schema) {
  if (!schema) return null
  const allColumns = [...defaultColumns(), ...schemaColumns(schema)]
    .map(column => {
      if (!column.Cell) column.Cell = createCellFormatter(column)
      if (!column.Header) column.Header = createHeaderFormatter(column)
      return column
    })
  return allColumns
}

function createCellFormatter (column) {
  const { Widget, schema } = column
  return function CellFormatter (props) {
    const { cell: { value, row } } = props
    // TODO: Rethink if we wanna do row.original = record.
    if (Widget) return <Widget value={value} fieldSchema={schema} record={row.original} />
    return String(value)
  }
}

function createHeaderFormatter (column) {
  const { title, id } = column
  return title || id
}

function schemaColumns (type) {
  return type.fields().map(field => {
    return fieldColumn(field.address, field)
  })
}

function fieldColumn (key, fieldSchema) {
  const Widget = findWidget(fieldSchema)
  return {
    schema: fieldSchema,
    title: fieldSchema.title,
    id: 'value.' + key,
    accessor: row => row.value[key],
    Widget
  }
}

function defaultColumns () {
  return [
    {
      title: 'Actions',
      Widget: ActionsFormatter,
      showDefault: true,
      id: '_actions',
      disableSortBy: true,
      disableFilters: true,
      // TODO: The formatter doesn't use an acessor, it uses the record which is
      // the full row at the moment.
      accessor: () => undefined
    },
    {
      Header: 'ID',
      id: 'id',
      showDefault: true,
      accessor: 'id'
    },
    {
      Header: 'Source',
      id: 'key',
      showDefault: false,
      accessor: record => {
        return record.key
      }
    },
    {
      Header: 'Seq',
      id: 'seq',
      showDefault: false,
      accessor: 'seq'
    }
  ]
}

function ActionsFormatter (props) {
  // const { value, fieldSchema, record } = props
  // TODO: Rethink if the way we get hold of a "record" here is sound enough.
  const { record } = props
  return (
    <RecordLink record={record}>Open</RecordLink>
  )
}

function SchemaSelect (props) {
  const { onSchema, schema, ...other } = props
  const [schemas, setSchemas] = useState()
  useEffect(() => {
    loadSchemas()
      .then(schemas => setSchemas(schemas))
      .catch(err => log.error(err) && setSchemas(null))
  }, [])

  if (schemas === null) return <Loading />
  if (!schemas) return <div>No schemas</div>
  const selected = schema ? schema.name : false

  const menuItems = schemas.map(schema => ({ key: schema.name, value: schemaName(schema) }))

  return (
    <Box {...other}>
      <SchemaMenu onChange={onSelect} value={selected} items={menuItems} />
    </Box>
  )

  function schemaName (schema) {
    return schema.title || schema.name
  }

  function onSelect (name) {
    const schema = schemas.filter(s => s.name === name)[0]
    onSchema(schema)
  }
}

function SchemaMenu (props) {
  const { items, onChange, value } = props
  const title = value ? items.find(el => el.key === value).value : 'Select schema'
  return (
    <Menu>
      <MenuButton as={Button} size='sm' rightIcon='chevron-down'>
        {title}
      </MenuButton>
      <MenuList>
        <MenuOptionGroup type='radio' onChange={onChange} value={value}>
          {items.map(item => (
            <MenuItemOption key={item.key} value={item.key}>{item.value}</MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  )
}

function Loading () {
  return <div>Loading</div>
}

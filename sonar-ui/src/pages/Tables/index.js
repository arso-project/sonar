import React, { useState, useEffect, useMemo } from 'react'
import client from '../../lib/client'
import errors from '../../lib/error'
import { findWidget, RecordLink } from '../../components/Record'
import makeGlobalStateHook from '../../hooks/make-global-state-hook'

import Table from './Table'

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

async function loadData ({ schema }) {
  return client.query({ schema })
}

const useGlobalState = makeGlobalStateHook('tables')

function buildTableData (records, schema) {
  const rows = buildRowsFromRecords(records)
  const columns = buildColumnsFromSchema(schema)
  return { rows, columns }
}

export default function TablesPage (props) {
  const [data, setData] = useGlobalState('rows', null)
  const [schema, setSchema] = useGlobalState('schema', null)
  const schemaname = schema ? schema.name : null

  useEffect(() => {
    if (!schemaname) return
    loadData({ schema: schemaname })
      .then(data => setData(data))
      .catch(error => errors.push(error))
  }, [schemaname])

  const { rows, columns } = useMemo(() => {
    if (!data || !schema) return { rows: null, columns: null }
    return buildTableData(data, schema)
  }, [data, schema])

  return (
    <Flex direction='column' width='100%'>
      <SchemaSelect onSchema={setSchema} schema={schema} flex={0} />
      { columns && rows && (
        <Table
          columns={columns}
          rows={rows}
        />
      )}
    </Flex>
  )
}

function createCellFormatter (column) {
  return function CellFormatter (props) {
    const { cell: { value, row } } = props
    if (column.formatter) return column.formatter({ value, row: row.original })
    return String(value)
  }
}

function buildRowsFromRecords (records) {
  const rows = []
  for (let record of records) {
    const row = {}
    row._record = record
    row._id = record.id
    for (let [key, value] of Object.entries(record.value)) {
      row[key] = value
    }
    rows.push(row)
  }
  return rows
}

function buildColumnsFromSchema (schema) {
  const allColumns = [...defaultColumns(), ...schemaColumns(schema)]
    .map(column => {
      if (!column.Cell) {
        column.Cell = createCellFormatter(column)
      }
      return column
    })
  console.log({ allColumns })
  return allColumns
}

function schemaColumns (schema) {
  return Object.entries(schema.properties).map(([key, fieldSchema]) => {
    return fieldColumn(key, fieldSchema)
  })
}

function defaultColumns () {
  return [
    {
      Header: 'Actions',
      formatter: ActionsFormatter,
      accessor: '_actions'
    },
    {
      Header: 'ID',
      accessor: '_id'
    }
  ]
}

function fieldColumn (key, fieldSchema) {
  const Widget = findWidget(fieldSchema)
  return {
    Header: fieldSchema.title,
    accessor: key,
    formatter: ({ value, row }) => (
      <Widget value={value} fieldSchema={fieldSchema} />
    )
  }
}

function ActionsFormatter (props) {
  const { row } = props
  const { _id: id, _record: record } = row
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
      .catch(err => errors.push(err) && setSchemas(null))
  }, [])

  if (schemas === null) return <Loading />
  if (!schemas) return <div>No schemas</div>
  let selected = schema ? schema.name : false

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

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

async function loadTypes () {
  const types = await client.getTypes()
  return Object.values(types)
}

async function loadRecords ({ type }) {
  return await client.query('records', { type: type })
}

const useGlobalState = makeGlobalStateHook('tables')

export default function TablesPage (props) {
  const [records, setRecords] = useGlobalState('records', null)
  const [type, setType] = useGlobalState('type', null)
  const typename = type ? type.address : null

  useEffect(() => {
    if (!typename) return
    loadRecords({ type: typename })
      .then(records => setRecords(records))
      .catch(error => log.error(error))
  }, [typename])

  const rows = useMemo(() => buildRowsFromRecords(records), [records])
  const columns = useMemo(() => buildColumnsFromType(type), [type])

  const PreviewWrapper = useCallback(function PreviewWrapper (props) {
    const { row } = props
    return <Preview record={row} type={type} />
  }, [type])

  return (
    <Flex direction='column' width='100%'>
      <TypeSelect onType={setType} type={type} flex={0} />
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

function buildColumnsFromType (type) {
  if (!type) return null
  const allColumns = [...defaultColumns(), ...typeColumns(type)]
    .map(column => {
      if (!column.Cell) column.Cell = createCellFormatter(column)
      if (!column.Header) column.Header = createHeaderFormatter(column)
      return column
    })
  return allColumns
}

function createCellFormatter (column) {
  const { Widget, type } = column
  return function CellFormatter (props) {
    const { cell: { value, row } } = props
    // TODO: Rethink if we wanna do row.original = record.
    if (Widget) return <Widget value={value} fieldType={type} record={row.original} />
    return String(value)
  }
}

function createHeaderFormatter (column) {
  const { title, id } = column
  return title || id
}

function typeColumns (type) {
  return type.fields().map(field => {
    return fieldColumn(field.address, field)
  })
}

function fieldColumn (key, fieldType) {
  const Widget = findWidget(fieldType)
  return {
    type: fieldType,
    title: fieldType.title,
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
  // const { value, fieldType, record } = props
  // TODO: Rethink if the way we get hold of a "record" here is sound enough.
  const { record } = props
  return (
    <RecordLink record={record}>Open</RecordLink>
  )
}

function TypeSelect (props) {
  const { onType, type, ...other } = props
  const [types, setTypes] = useState()
  useEffect(() => {
    loadTypes()
      .then(types => setTypes(types))
      .catch(err => log.error(err) && setTypes(null))
  }, [])

  if (types === null) return <Loading />
  if (!types) return <div>No types</div>
  const selected = type ? type.name : false

  const menuItems = types.map(type => ({ key: type.name, value: typeName(type) }))

  return (
    <Box {...other}>
      <TypeMenu onChange={onSelect} value={selected} items={menuItems} />
    </Box>
  )

  function typeName (type) {
    return type.title || type.name
  }

  function onSelect (name) {
    const type = types.filter(s => s.name === name)[0]
    onType(type)
  }
}

function TypeMenu (props) {
  const { items, onChange, value } = props
  const title = value ? items.find(el => el.key === value).value : 'Select type'
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

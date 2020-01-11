import React, { useState, useEffect, useMemo } from 'react'
import ReactDataGrid from 'react-data-grid'
import client from '../../lib/client'
// import './styles.css'
import errors from '../../lib/error'
import { findWidget, RecordLink } from '../../components/Record'
import makeGlobalStateHook from '../../hooks/make-global-state-hook'

// import './tables.css'
import {
  Select,
  Box,
  Flex,
  Link,
  Checkbox,
  CheckboxGroup,
  Input,
  Heading,
  Switch,
  PseudoBox,
  Button,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuDivider,
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

export default function TablesPage (props) {
  const [rows, setRows] = useGlobalState('rows', null)
  // TODO: useGlobalState has some bug that breaks table sorting.
  // const [rows, setRows] = useState(null)
  const [schema, setSchema] = useGlobalState('schema', null)
  const [columns, setColumns] = useGlobalState('columns', null)
  const [count, setCount] = useGlobalState('count', 100)
  const schemaname = schema ? schema.name : null

  useEffect(() => {
    if (!schema) return
    loadData({ schema: schemaname })
      .then(records => {
        const rows = formatRows(records)
        setRows(rows)
      })
      .catch(error => errors.push(error))
  }, [schemaname])

  // const rows = useMemo(() => {
  //   if (!records) return null
  //   const rows = formatRows(records)
  //   return rows
  // }, [records])

  function onGridRowsUpdated (props) {
    const { fromRow, toRow, updated } = props
    setRows(rows => {
      const slice = rows.slice()
      for (let i = fromRow; i <= toRow; i++) {
        slice[i] = { ...rows[i], ...updated }
      }
      return rows
    })
  }

  function onCellSelected (cell) {
    const row = getRow(cell.rowIdx)
    console.log(row)
  }

  function getRow (i) {
    return rows[i]
  }

  return (
    <div>
      <SchemaSelect onSchema={setSchema} schema={schema} />
      { schema && (
        <div>
          <ColumnSelect schema={schema} columns={columns} onColumns={setColumns} />
          <div>
            Display:
            <input type='number' value={count} onChange={e => setCount(e.target.value)} />
          </div>
        </div>
      )}
      { columns && rows && (
        <ReactDataGrid
          columns={columns}
          rowGetter={getRow}
          rowsCount={count}
          onGridRowsUpdated={onGridRowsUpdated}
          onCellSelected={onCellSelected}
          onGridSort={(sortColumn, sortDirection) =>
            setRows(sortRows(sortColumn, sortDirection))
          }
        />
      )}
    </div>
  )
}

function sortRows (col, sortDirection) {
  return function (rows) {
    if (sortDirection === 'NONE') return rows
    rows = [...rows]
    rows.sort((a, b) => {
      if (sortDirection === 'ASC') {
        return a[col] > b[col] ? 1 : -1
      } else if (sortDirection === 'DESC') {
        return a[col] < b[col] ? 1 : -1
      }
    })
    return rows
  }
}

function formatRows (records) {
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

function ColumnSelect (props) {
  const { schema, columns = {}, onColumns } = props
  // TODO: Cache?
  const allColumns = [...defaultColumns(), ...schemaColumns(schema)]
  const selected = columns ? columns.map(c => c.key) : ['_actions', '_id']

  useEffect(() => {
    updateColumns(selected)
  }, [])

  return (
    <Box p={2}>
      <CheckboxGroup defaultValue={selected} isInline onChange={updateColumns}>
        {allColumns.map((column) => {
          const { key, name } = column
          const checked = selected.indexOf(key) !== -1
          const cls = checked ? 'checked' : ''
          return (
            <Checkbox key={key} value={key}>{name}</Checkbox>
          )
        })}
      </CheckboxGroup>
    </Box>
  )

  function updateColumns (selected) {
    const selectedColumns = allColumns.filter(col => selected.indexOf(col.key) !== -1)
    onColumns(selectedColumns)
  }
}

function schemaColumns (schema) {
  return Object.entries(schema.properties).map(([key, fieldSchema]) => {
    return fieldColumn(key, fieldSchema)
  })
}

function defaultColumns () {
  return [
    {
      key: '_actions',
      name: 'Actions',
      formatter: ActionsFormatter,
      resizable: true,
      editable: false
    },
    {
      key: '_id',
      name: 'ID',
      resizable: true,
      editable: false
    }
  ]
}

function fieldColumn (key, fieldSchema) {
  const Widget = findWidget(fieldSchema)
  return {
    key,
    name: fieldSchema.title,
    sortable: true,
    editable: false,
    resizable: true,
    // onCellSelected,
    formatter: (props) => {
      const { value } = props
      return <Widget value={value} fieldSchema={fieldSchema} />
    }
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
  const { onSchema, schema } = props
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
    <SchemaMenu onChange={onSelect} value={selected} items={menuItems} />
  )
  // return (
  //   <div>
  //     <Select onChange={onSelect} value={selected} placeholder='-- select schema --'>
  //       {schemas.map(schema => (
  //         <option key={schema.name} value={schema.name}>{schemaName(schema)}</option>
  //       ))}
  //     </Select>
  //   </div>
  // )

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
  console.log(items, value)
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

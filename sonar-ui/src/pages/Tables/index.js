import React, { useState, useEffect, useMemo } from 'react'
import ReactDataGrid from 'react-data-grid'
import client from '../../lib/client'
// import './styles.css'
import errors from '../../lib/error'
import { findWidget, RecordLink } from '../../components/Record'
import makeGlobalStateHook from '../../hooks/make-global-state-hook'

async function loadSchemas () {
  return client.query({ schema: 'core/schema' })
}

async function loadData ({ schema }) {
  console.log('load', schema)
  return client.query({ schema })
}

const useGlobalState = makeGlobalStateHook('tables')

export default function TablesPage (props) {
  const [rows, setRows] = useGlobalState('rows', null)
  const [schema, setSchema] = useGlobalState('schema', null)
  const [columns, setColumns] = useGlobalState('columns', null)
  const schemaid = schema ? schema.id : null

  useEffect(() => {
    if (!schema) return
    loadData({ schema: schema.value.name })
      .then(records => {
        const rows = formatRows(records)
        setRows(rows)
      })
      .catch(error => errors.push(error))
  }, [schemaid])

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

  console.log('render! cols', columns)

  return (
    <div>
      <SchemaSelect onSchema={setSchema} schema={schema} />
      { schema && (
        <ColumnSelect schema={schema} columns={columns} onColumns={setColumns} />
      )}
      { columns && rows && (
        <ReactDataGrid
          columns={columns}
          rowGetter={getRow}
          rowsCount={30}
          onGridRowsUpdated={onGridRowsUpdated}
          onCellSelected={onCellSelected}
        />
      )}
    </div>
  )
}

function ContextMenu (props) {
  const [visible, setVisible] = useState(false)
  const { children, title, icon } = props
  return (
    <div className='sonar-context-menu'>
      <div className='sonar-context-menu__title'>{title}</div>
      <div className='sonar-context-menu__menu'>{children}</div>
    </div>
  )
}

function formatRows (records) {
  const rows = []
  for (let record of records) {
    const row = {}
    row._record = record
    row._id = record.id
    for (let [key, value] of Object.entries(record.value)) {
      // row[key] = JSON.stringify(value)
      row[key] = value
    }
    rows.push(row)
  }
  return rows
}

function ColumnSelect (props) {
  const { schema, columns = {}, onColumns } = props

  const fields = Object.entries(schema.value.properties)

  // const [selected, setSelected] = useGlobalState('selectedcolumns', {})
  const selected = columns ? columns.map(c => c.key) : []

  // useEffect(() => {
  //   const columns = buildColumns(schema, selected)
  //   onColumns(columns)
  // }, [schema, selected])

  return (
    <div>
      <form>
        {fields.map(([key, schema]) => {
          return (
            <div>
              <input type='checkbox' value={key} key={key} name={key} defaultChecked={selected.indexOf(key) !== -1} onChange={onChange} />
              <label htmlFor={key}>{schema.title}</label>
            </div>
          )
        })}
      </form>
    </div>
  )

  function onChange (e) {
    const { name, checked } = e.target
    let next
    if (checked) next = [...selected, name]
    else next = selected.filter(c => c !== name)
    console.log('onchange', selected, next)
    const columns = buildColumns(schema, next)
    onColumns(columns)
    // const nextSelected
    // setSelected(selected => {
    //   return { ...selected, [name]: checked }
    // })
  }

  function buildColumns (schema, selected) {
    let fields = Object.entries(schema.value.properties)
    fields = fields.filter(([key, value]) => selected.indexOf(key) !== -1)
    const columns = defaultColumns()
    for (let [key, fieldSchema] of fields) {
      columns.push(fieldColumn(key, fieldSchema))
    }

    for (const column of columns) {
      column.editable = false
      column.resizable = true
    }
    return columns
  }
}

function defaultColumns () {
  return [
    {
      key: '_actions',
      editable: false,
      formatter: ActionsFormatter
    },
    {
      key: '_id',
      name: 'ID',
      editable: false
    }
  ]
}

function ActionsFormatter (props) {
  const { row } = props
  const { _id: id, _record: record } = row
  return (
    <RecordLink record={record}>Open</RecordLink>
  )
}

function fieldColumn (key, fieldSchema) {
  return {
    key,
    name: fieldSchema.title,
    sortable: true,
    // onCellSelected,
    formatter: (props) => {
      const { value } = props
      const Widget = findWidget(fieldSchema)
      return <Widget value={value} fieldSchema={fieldSchema} />
    }
  }
}

// function Grid (props) {
//   const { schema } = props
// }

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
  let selected = schema ? schema.id : '__default__'

  return (
    <div>
      <select onChange={onSelect} value={selected}>
        <option disabled value='__default__'> -- select schema -- </option>
        {schemas.map(schema => (
          <option key={schema.id} value={schema.id}>{schemaName(schema)}</option>
        ))}
      </select>
    </div>
  )

  function schemaName (schema) {
    return schema.value.title || schema.id
  }

  function onSelect (e) {
    const id = e.target.value
    const schema = schemas.filter(s => s.id === id)[0]
    onSchema(schema)
  }
}

function Loading () {
  return <div>Loading</div>
}

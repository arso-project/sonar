import React, { useState, useEffect, useMemo } from 'react'
import ReactDataGrid from 'react-data-grid'
import client from '../../lib/client'
// import './styles.css'
import errors from '../../lib/error'
import { findWidget, RecordLink } from '../../components/Record'
import makeGlobalStateHook from '../../hooks/make-global-state-hook'

import './tables.css'

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
            Count:
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
        />
      )}
    </div>
  )
}

// function ContextMenu (props) {
//   const [visible, setVisible] = useState(false)
//   const { children, title, icon } = props
//   return (
//     <div className='sonar-context-menu'>
//       <div className='sonar-context-menu__title'>{title}</div>
//       <div className='sonar-context-menu__menu'>{children}</div>
//     </div>
//   )
// }

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
    <div className='sonar-tables--column-select'>
      <form>
        {allColumns.map((column) => {
          const { key, name } = column
          const checked = selected.indexOf(key) !== -1
          const cls = checked ? 'checked' : ''
          return (
            <div key={key} className={cls}>
              <label>
                <input type='checkbox' value={key} key={key} name={key} defaultChecked={checked} onChange={onChange} />
                {name}
              </label>
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
    updateColumns(next)
  }

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
  let selected = schema ? schema.name : '__default__'

  return (
    <div>
      <select onChange={onSelect} value={selected}>
        <option disabled value='__default__'> -- select schema -- </option>
        {schemas.map(schema => (
          <option key={schema.name} value={schema.name}>{schemaName(schema)}</option>
        ))}
      </select>
    </div>
  )

  function schemaName (schema) {
    return schema.title || schema.name
  }

  function onSelect (e) {
    const name = e.target.value
    const schema = schemas.filter(s => s.name === name)[0]
    onSchema(schema)
  }
}

function Loading () {
  return <div>Loading</div>
}

import React from 'react'
import { useTable, useBlockLayout } from 'react-table'
import { FixedSizeList } from 'react-window'
import {
  Box
} from '@chakra-ui/core'

// const Styles = styled.div`
//   padding: 1rem;

//   .table {
//     display: inline-block;
//     border-spacing: 0;
//     border: 1px solid black;

//     .tr {
//       :last-child {
//         .td {
//           border-bottom: 0;
//         }
//       }
//     }

//     .th,
//     .td {
//       margin: 0;
//       padding: 0.5rem;
//       border-bottom: 1px solid black;
//       border-right: 1px solid black;

//       :last-child {
//         border-right: 0;
//       }
//     }
//   }
// `

function Cell (props) {
  return (
    <Box {...props} overflow='hidden' borderRightWidth='1px' whiteSpace='nowrap' p='1' />
  )
}
function Row (props) {
  return (
    <Box {...props} overflow='hidden' borderBottomWidth='1px' />
  )
}

function Table({ columns, data }) {
  // Use the state and functions returned from useTable to build your UI

  const defaultColumn = React.useMemo(
    () => ({
      width: 150,
    }),
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    totalColumnsWidth,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
      defaultColumn,
    },
    useBlockLayout
  )

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index]
      prepareRow(row)
      return (
        <Row
          {...row.getRowProps({
            style,
          })}
        >
          {row.cells.map(cell => {
            return (
              <Cell {...cell.getCellProps()}>
                {cell.render('Cell')}
              </Cell>
            )
          })}
        </Row>
      )
    },
    [prepareRow, rows]
  )

  // Render the UI for your table
  return (
    <div {...getTableProps()} className="table">
      <div>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className="tr">
            {headerGroup.headers.map(column => (
              <div {...column.getHeaderProps()} className="th">
                {column.render('Header')}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div {...getTableBodyProps()}>
        <FixedSizeList
          height={400}
          itemCount={rows.length}
          itemSize={35}
          width={totalColumnsWidth}
        >
          {RenderRow}
        </FixedSizeList>
      </div>
    </div>
  )
}

export default function TableWrapper (props) {
  const { columns, rows } = props
  console.log('P', props)
  return (
    <Table columns={columns} data={rows} />
  )
}

import React, { useRef, useMemo, forwardRef, useState } from 'react'
import { debounce } from 'lodash'
import {
  useTable,
  // useBlockLayout,
  // useFlexLayout,
  useSortBy,
  useFilters,
  useAbsoluteLayout,
  useResizeColumns
} from 'react-table'
import { FixedSizeList } from 'react-window'
import useSize from '../../hooks/use-size'
import FocusLock from 'react-focus-lock'
import {
  useColorMode,
  Badge,
  PseudoBox,
  Box,
  FormControl,
  FormLabel,
  Checkbox,
  Button,
  Flex,
  Text,
  IconButton,
  Select,
  Input,
  // Slider,
  // SliderTrack,
  // SliderFilledTrack,
  // SliderThumb,
  // SimpleGrid,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  // PopoverHeader,
  // PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
  // MenuGroup,
  // MenuDivider,
  // MenuOptionGroup,
  // MenuItemOption
} from '@chakra-ui/core'
import {
  // FaSortUp,
  // FaSortDown,
  FaSortAmountDown,
  FaSortAmountUp,
  FaFilter,
  FaTable,
  FaSort
} from 'react-icons/fa'
import {
  MdClose
  // MdViewColumn
} from 'react-icons/md'

const TBORDER = 'gray.300'

export default function TableWrapper (props) {
  const { columns, rows: data } = props
  return (
    <Table data={data} columns={columns} />
  )
}

function Cell (props) {
  const { children, ...other } = props
  return (
    <Box
      {...other}
      borderRightWidth='1px'
      borderColor={TBORDER}
      display='flex'
      height='100%'
      overflow='hidden'
      p='1'
    >
      <Box flex='1' overflow='hidden' display='flex' maxWidth='100%' whiteSpace='nowrap'>{children}</Box>
    </Box>
  )
}
function Row (props) {
  return (
    <Box {...props} overflow='hidden' borderBottomWidth='1px' borderColor={TBORDER} />
  )
}

function ColumnHeader (props) {
  const { column } = props
  const headerProps = column.getHeaderProps()
  const sortIcon = column.isSorted
    ? column.isSortedDesc
      ? FaSortAmountDown
      : FaSortAmountUp
    : null

  const { colorMode } = useColorMode()
  let bg = { light: 'white', dark: 'gray.800' }

  return (
    <div {...headerProps} style={{ ...headerProps.style, position: 'absolute' }}>
      <Box
        display='flex'
        overflow='hidden'
        borderRightWidth='1px'
        borderBottomWidth='2px'
        whiteSpace='nowrap'
        p='2'
        pr='4'
        fontWeight='600'
        zIndex='200'
        bg={bg[colorMode]}
      >
        <Box flex='1' mr={2}>{column.render('Header')}</Box>
        { column.isSorted && <HeaderColumnIcon icon={sortIcon} /> }
        { column.filterValue && <HeaderColumnIcon icon={FaFilter} /> }
        <ColumnHeaderMenu column={column} />
      </Box>
      <PseudoBox
        position='absolute'
        right='-3px'
        zIndex='400'
        top='0'
        bottom='0'
        width='8px'
        opacity={column.isResizing ? 0.9 : 0}
        bg={column.isResizing ? 'orange.400' : 'yellow.400'}
        _hover={{ opacity: 0.5 }}
        {...column.getResizerProps()}
      />
    </div>
  )
}

function HeaderColumnIcon (props) {
  return <Box as={props.icon} mt={1} mr={1} color={'grey.100'} {...props} />
}

function ColumnHeaderMenu (props) {
  const { column } = props
  const { toggleSortBy } = column
  const ascActive = !!(column.isSorted && !column.isSortedDesc)
  const descActive = !!(column.isSorted && column.isSortedDesc)
  return (
    <Menu closeOnSelect={false}>
      <MenuButton as={IconButton} size='xs' icon='chevron-down' />
      <MenuList>
        <HeaderMenuItem icon={FaSortAmountUp} active={ascActive} onClick={() => toggleSortBy(false)}>
          Sort ascending
        </HeaderMenuItem>
        <HeaderMenuItem icon={FaSortAmountDown} active={descActive} onClick={() => toggleSortBy(true)}>
          Sort descending
        </HeaderMenuItem>
        <HeaderMenuItem icon={MdClose} onClick={() => column.toggleHidden()}>
          Hide column
        </HeaderMenuItem>
        <HeaderMenuItem icon={FaFilter} onClick={() => {}}>Filter</HeaderMenuItem>
      </MenuList>
    </Menu>
  )
}

function HeaderMenuItem (props) {
  const { onClick, children, icon, active, ...other } = props
  const color = active ? 'green.500' : undefined
  return (
    <MenuItem onClick={e => onClick && onClick()} color={color} {...other} >
      <Box as={icon} mr='1' />
      {children}
    </MenuItem>
  )
}

// Define a default UI for filtering
const DefaultColumnFilter = forwardRef((props, ref) => {
  const { column: { filterValue, preFilteredRows, setFilter } } = props
  const count = preFilteredRows.length
  const debouncedSetFilter = useMemo(() => {
    return debounce(setFilter, 100)
  }, [])
  function onChange (e) {
    debouncedSetFilter(e.target.value || undefined)
  }

  return (
    <Input
      defaultValue={filterValue || ''}
      onChange={onChange}
      placeholder={`Search ${count} records...`}
      ref={ref}
    />
  )
})

function Table (props) {
  const {
    columns,
    data,
    listRef = React.createRef(null)
  } = props

  const defaultColumn = React.useMemo(() => ({
    width: 150,
    Filter: DefaultColumnFilter
  }), [])

  const table = useTable(
    {
      columns,
      data,
      defaultColumn,
      initialState: {
        hiddenColumns: columns.map(c => c.accessor).filter(k => !k.startsWith('_'))
      }
    },
    useAbsoluteLayout,
    useFilters,
    useSortBy,
    useResizeColumns
  )
  const {
    state: internalTableState,
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    totalColumnsWidth,
    prepareRow,
    flatColumns
  } = table

  const cellHeight = 32
  const headerHeight = cellHeight

  // TODO: Cache header better?
  // const header = <RenderHeader />
  const RenderHeader = React.useCallback(function RenderHeader (props) {
    return (
      <div className='thead'>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className='tr'>
            {headerGroup.headers.map(column => <ColumnHeader key={column.id} column={column} />)}
          </div>
        ))}
      </div>
    )
  }, [headerGroups, totalColumnsWidth])
  const isResizingColumn = internalTableState.columnResizing.isResizingColumn

  const RenderRow = React.useCallback((props) => {
    let { index, style } = props
    const row = rows[index]
    prepareRow(row)
    return (
      <Row {...row.getRowProps({ style })}>
        {row.cells.map(cell => {
          if (isResizingColumn) {
            return (
              <Box {...cell.getCellProps()}
                bg={isResizingColumn === cell.column.id ? 'yellow.200' : undefined}
                h='100%'
              />
            )
          }
          // TODO: Memoize actual (inner) cell rendering?
          return (
            <Cell {...cell.getCellProps()}>
              {cell.render('Cell')}
            </Cell>
          )
        })}
      </Row>
    )
  }, [prepareRow, rows, isResizingColumn])

  const innerElementType = React.useMemo(() => forwardRef((props, ref) => {
    const { style, children, ...other } = props
    return (
      <React.Fragment>
        <div style={{ top: 0, position: 'sticky', height: headerHeight + 'px', backgroundColor: 'inherit', zIndex: 1000 }}>
          <RenderHeader />
        </div>
        <div
          {...other}
          ref={ref}
          style={{ ...style, position: 'relative', width: totalColumnsWidth + 'px' }}
        >
          {children}
        </div>
      </React.Fragment>
    )
  }), [totalColumnsWidth])

  return (
    <Flex direction='column' flex={1} overflowX='auto' {...getTableProps()}>
      <TableMeta columns={flatColumns} />
      <AutoSizeList
        itemCount={rows.length}
        itemSize={cellHeight}
        innerElementType={innerElementType}
        ref={listRef}
      >
        {RenderRow}
      </AutoSizeList>
    </Flex>
  )
}

const AutoSizeList = forwardRef((props, ref) => {
  const containerRef = useRef(null)
  const [width, height] = useSize(containerRef)
  const containerStyle = { position: 'relative', flex: '1' }
  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={{ overflow: 'visible', position: 'absolute', height: 0, width: 0 }}>
        <FixedSizeList
          ref={ref}
          width={width}
          height={height}
          {...props}
        />
      </div>
    </div>
  )
})

function TableMeta (props) {
  const { columns } = props
  const visible = columns.map(c => c.getToggleHiddenProps()).filter(x => x.checked).length
  // const { colorMode } = useColorMode()
  // const bg = { light: 'gray.100', dark: 'gray.700' }
  // const bg = { light: undefined, dark: undefined }
  const filters = columns.filter(c => c.filterValue !== undefined).length
  const sorts = columns.filter(c => c.isSorted).length

  return (
    <Flex mt={2}>
      <SimplePopover header='Columns' badge={visible} icon={FaTable}>
        <TableColumns columns={columns} />
      </SimplePopover>
      <SimplePopover header='Filter' badge={filters} icon={FaFilter}>
        <TableFilter columns={columns} />
      </SimplePopover>
      <SimplePopover header='Sort' badge={sorts} icon={FaSort}>
        <TableSort columns={columns} />
      </SimplePopover>
    </Flex>
  )
}

function SimplePopover (props) {
  const { children, icon, header, badge } = props
  const initialFocusRef = useRef()
  return (
    <Popover
      initialFocusRef={initialFocusRef}
      closeOnBlur
      placement='bottom'
    >
      {({ isOpen, onClose }) => (
        <React.Fragment>
          <PopoverTrigger>
            <Button
              leftIcon={icon}
              bg={isOpen ? 'orange.300' : undefined}
              _hover={{ bg: isOpen ? 'orange.500' : 'gray.200' }}
              size='sm'
              mr={[2, 4]}
            >
              {header}
              {badge !== undefined && (
                <Badge fontSize='sm' ml={2} variantColor={badge ? 'orange' : undefined}>{badge}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent zIndex={4} maxWidth='40rem' bg='gray.50'>
            <PopoverArrow bg='gray.50' />
            <PopoverCloseButton />
            <PopoverBody>
              <FocusLock returnFocus persistentFocus={false}>
                <Box>
                  {children}
                </Box>
              </FocusLock>
            </PopoverBody>
          </PopoverContent>
        </React.Fragment>
      )}
    </Popover>
  )
}

function TableFilter (props) {
  const { columns } = props
  const [newfilters, setNewfilters] = useState([])
  const filters = columns.filter(c => c.filterValue !== undefined)
  newfilters.forEach(c => (filters.indexOf(c) === -1 && filters.push(c)))
  const canFilters = columns.filter(c => c.filterValue === undefined && c.canFilter)
  let list
  if (!filters.length) {
    list = (
      <Text>No filters defined.</Text>
    )
  } else {
    list = filters.map(column => {
      return (
        <FormControl as={Flex} key={column.id}>
          <FormLabel width='20rem' fontWeight='bold'>{column.render('Header')}</FormLabel>
          {column.render('Filter')}
        </FormControl>
      )
    })
  }
  return (
    <Box>
      {list}
      <Box>
      Create a filter
        <Select onChange={e => addFilter(e.target.value)}>
          {canFilters.map(c => <option key={c.id} value={c.id}>{c.render('Header')}</option>)}
        </Select>
      </Box>
    </Box>
  )

  function addFilter (id) {
    let col = columns.filter(c => c.id === id)[0]
    if (!col) return
    setNewfilters(f => [...f, col])
  }
}

function TableSort (props) {
  const { columns } = props
  const sorted = columns.filter(c => c.isSorted)
  return (
    <Box>
      {sorted.map(c => (
        <Flex>
          <Box w='20rem' flexGrow='0' p='2'>{c.render('Header')}</Box>
          <Box p='2'>{c.isSorted ? 'desc' : 'asc'}</Box>
        </Flex>
      ))}
    </Box>
  )
}

function TableColumns (props) {
  const { columns } = props
  return (
    <Box p={2}>
      {columns.map(column => {
        const { checked, onChange } = column.getToggleHiddenProps()
        return (
          <Checkbox key={column.id} onChange={onChange} isChecked={checked} mr={4} >
            {column.render('Header')}
          </Checkbox>
        )
      })}
    </Box>
  )
}

// function TableSlider (props) {
//   const { count } = props
//   const [value, setValue] = useState(0)
//   return (
//     <Flex flex={0} h='2rem' maxWidth='20rem'>
//       <Box mr='4' flex='0' flexBasis='10rem' whiteSpace='nowrap' fontWeight='bold'>
//         {value} / {count}
//       </Box>
//       <Slider value={value} min={0} max={count} step={10} onChange={onChange}>
//         <SliderTrack />
//         <SliderFilledTrack />
//         <SliderThumb />
//       </Slider>
//     </Flex>
//   )
//   function onChange (val) {
//     setValue(val)
//     if (props.onChange) props.onChange(val)
//   }
// }

// function ColumnHeaderFilter (props) {
//   const { column } = props
//   const initialFocusRef = useRef()
//   if (!column.canFilter) return null
//   return (
//     <Popover
//       initialFocusRef={initialFocusRef}

//     >
//       <PopoverTrigger>
//         <HeaderButton
//           icon={FaFilter}
//           active={column.filterValue}
//         />
//       </PopoverTrigger>
//       <PopoverContent zIndex={4}>
//         <PopoverArrow />
//         <PopoverCloseButton />
//         <PopoverHeader>Filter</PopoverHeader>
//         <PopoverBody>
//           {column.render('Filter', { ref: initialFocusRef })}
//         </PopoverBody>
//       </PopoverContent>
//     </Popover>
//   )
// }
//
// function ColumnHeaderButtons (props) {
//   const { column } = props
//   return (
//     <React.Fragment>
//       <HeaderButton
//         icon={sortIcon}
//         active={column.isSorted}
//         {...sortToggleProps}
//       />
//       {column.canFilter && <ColumnHeaderFilter column={column} />}
//       <CloseButton size='sm' onClick={e => column.toggleHidden()} />
//     </React.Fragment>
//   )
// }
//
// const HeaderButton = forwardRef((props, ref) => {
//   return (
//     <IconButton
//       ref={ref}
//       size='xs'
//       variant='ghost'
//       variantColor={props.active ? 'green' : 'gray'}
//       {...props}
//     />
//   )
// })

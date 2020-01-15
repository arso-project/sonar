import React, { Fragment, useRef, useEffect, useMemo, forwardRef, useCallback, useState, useReducer } from 'react'
import { debounce } from 'lodash'
import Debug from 'debug'
import {
  useTable,
  // useBlockLayout,
  // useFlexLayout,
  useSortBy,
  useFilters,
  useAbsoluteLayout,
  useResizeColumns,
  useRowSelect
} from 'react-table'
import { FixedSizeList } from 'react-window'
import useSize from '../../hooks/use-size'
import FocusLock, { AutoFocusInside } from 'react-focus-lock'
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
  Switch,
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
  FaSortAlphaDown,
  FaSortAlphaUp,
  FaFilter,
  FaWindowClose,
  FaTable,
  FaSort
} from 'react-icons/fa'
import {
  IoMdEye
} from 'react-icons/io'

const debug = Debug('sonar:table')
const TBORDER = 'gray.300'

export default function TableWrapper (props) {
  const { columns, rows: data, ...other } = props
  return (
    <Table data={data} columns={columns} {...other} />
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
  const { isSelected, ...other } = props
  // TODO: Dark mode
  const bg = isSelected ? 'yellow.100' : undefined
  const hover = { bg: isSelected ? 'yellow.200' : 'gray.50' }
  return (
    <PseudoBox {...other}
      overflow='hidden'
      borderBottomWidth='1px'
      borderColor={TBORDER}
      bg={bg}
      _hover={hover}
      {...other}
    />
  )
}

function ColumnHeader (props) {
  const { column, dispatch } = props
  const headerProps = column.getHeaderProps()
  const sortIcon = column.isSorted
    ? column.isSortedDesc
      ? FaSortAlphaUp
      : FaSortAlphaDown
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
        <ColumnHeaderMenu column={column} dispatch={dispatch} />
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
  const { column, dispatch } = props
  const { toggleSortBy, toggleHidden, canSort, canFilter } = column
  const asc = !!(column.isSorted && !column.isSortedDesc)
  const desc = !!(column.isSorted && column.isSortedDesc)
  const list = (
    <MenuList>
      {canSort && (
        <HeaderMenuItem icon={FaSortAlphaDown} active={asc} onClick={() => toggleSortBy(false)}>
            Sort ascending
        </HeaderMenuItem>
      )}
      {canSort && (
        <HeaderMenuItem icon={FaSortAlphaUp} active={desc} onClick={() => toggleSortBy(true)}>
            Sort descending
        </HeaderMenuItem>
      )}
      {canFilter && (
        <HeaderMenuItem icon={FaFilter} onClick={onFilterClick}>
            Filter
        </HeaderMenuItem>
      )}
      <HeaderMenuItem icon={FaWindowClose} onClick={() => toggleHidden()}>
          Hide column
      </HeaderMenuItem>
    </MenuList>
  )

  return (
    <Menu closeOnSelect={false}>
      <MenuButton as={IconButton} size='xs' icon='chevron-down' />
      {list}
    </Menu>
  )

  function onFilterClick (e) {
    dispatch({ type: 'filter.add', data: column.id })
  }
}

function HeaderMenuItem (props) {
  const { onClick, children, icon, active, ...other } = props
  // const color = active ? 'green.600' : undefined
  const fontWeight = active ? 'bold' : undefined
  return (
    <MenuItem onClick={e => onClick && onClick()} fontWeight={fontWeight} {...other} >
      <Box as={icon} mr='1' />
      {children}
    </MenuItem>
  )
}

// Define a default UI for filtering
const DefaultColumnFilter = forwardRef((props, ref) => {
  const { column: { filterValue, preFilteredRows, setFilter }, ...other } = props
  const count = preFilteredRows.length
  const debouncedSetFilter = useMemo(() => {
    return debounce(setFilter, 100)
  }, [])
  function onChange (e) {
    debouncedSetFilter(e.target.value || undefined)
  }

  return (
    <Input
      {...other}
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
    listRef = React.createRef(null),
    selectMode = 'single',
    Preview
    // onSelect
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
        hiddenColumns: columns.filter(c => !c.showDefault).map(c => c.id)
      }
    },
    useAbsoluteLayout,
    useFilters,
    useSortBy,
    useResizeColumns,
    useRowSelect
  )
  const {
    state: internalTableState,
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    totalColumnsWidth,
    prepareRow,
    flatColumns,
    selectedFlatRows
  } = table

  const cellHeight = 32
  const headerHeight = cellHeight

  const [uiState, dispatchUi] = useReducer(uiReducer, { addfilters: [], pane: { preview: true } })

  // TODO: Cache header better?
  // const header = <RenderHeader />
  const RenderHeader = React.useCallback(function RenderHeader (props) {
    debug('render header')
    return (
      <div className='thead'>
        {headerGroups.map(headerGroup => (
          <div {...headerGroup.getHeaderGroupProps()} className='tr'>
            {headerGroup.headers.map(column => (
              <ColumnHeader key={column.id} column={column} dispatch={dispatchUi} />
            ))}
          </div>
        ))}
      </div>
    )
  }, [headerGroups, totalColumnsWidth])

  const isResizingColumn = internalTableState.columnResizing.isResizingColumn

  const RenderRow = React.useCallback(function RenderRow (props) {
    const { index, style } = props
    const row = rows[index]

    prepareRow(row)

    let onRowClick
    if (selectMode) {
      onRowClick = function onRowClick (e) {
        debug('!select', row.id, 'to', !row.isSelected)
        if (selectMode === 'single') table.toggleAllRowsSelected(false)
        row.toggleRowSelected()
      }
    }

    // debug('render row id %o isSelected %o', row.id, row.isSelected)
    return (
      <Row {...row.getRowProps({ style, isSelected: row.isSelected, onClick: onRowClick })}>
        {row.cells.map(cell => {
          // TODO: The rendering while resizing a column still is slow.
          // We should debounce and animate the inbetweens likely.
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
  // TODO: isResizingColumn maybe shouldn't be in these deps but instead be a property on the row
  }, [prepareRow, rows, isResizingColumn, selectMode])

  // TODO: This does not work and is a wrong pattenr of upcasting state.
  // const [lastSelected, setLastSelected] = useState(null)
  // useEffect(() => {
  //   if (!onSelect) return
  //   if (lastSelected === selectedFlatRows) return
  //   if (!selectedFlatRows.length) return onSelect(null)
  //   const rows = selectedFlatRows.map(row => row.original)
  //   setLastSelected(selectedFlatRows)
  //   if (selectMode === 'single') onSelect(rows[0])
  //   else onSelect(rows)
  // }, [selectMode, onSelect, selectedFlatRows])

  const innerElementType = useMemo(() => forwardRef((props, ref) => {
    const { style, children, ...other } = props
    debug('render inner')
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
  }), [totalColumnsWidth, selectedFlatRows, rows])

  const renderedPreview = useMemo(() => {
    if (!uiState.pane.preview) return null
    if (!Preview || selectedFlatRows.length !== 1) return null
    let row = selectedFlatRows[0]
    return (
      <FlexContainer flexBasis='50%'>
        <Preview row={row.original} />
      </FlexContainer>
    )
  }, [Preview, selectedFlatRows, uiState.pane.preview])

  // TODO: previewActive should likely be part of uiState
  const tableMeta = useMemo(() => {
    return <TableMeta columns={flatColumns} uiState={uiState} dispatch={dispatchUi} previewActive={!!renderedPreview} />
  }, [flatColumns, uiState, table.rows, table.flatHeaders, !!renderedPreview])

  debug('render table: rows %o, cols %o, selected %o', data.length, selectedFlatRows.length)
  return (
    <Flex direction='column' flex={1} {...getTableProps()}>
      {tableMeta}
      <Flex flex='1'>
        <AutoSizeList
          itemCount={rows.length}
          itemSize={cellHeight}
          innerElementType={innerElementType}
          ref={listRef}
        >
          {RenderRow}
        </AutoSizeList>
        {renderedPreview}
      </Flex>
    </Flex>
  )
}

function uiReducer (state, action) {
  const x = (nextState) => ({ ...state, ...nextState })
  switch (action.type) {
    case 'filter.add':
      const addfilters = state.addfilters
      if (addfilters.indexOf(action.data) !== -1) return state
      return x({
        addfilters: [...state.addfilters, action.data],
        pane: { ...state.pane, filter: true }
      })
    case 'pane.open':
      return x({ pane: { ...state.pane, [action.name]: true } })
    case 'pane.close':
      return x({ pane: { ...state.pane, [action.name]: false } })
    case 'pane.toggle':
      let current = state.pane[action.name]
      return x({ pane: { ...state.pane, [action.name]: !current } })
  }
  return state
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

function FlexContainer (props) {
  const { children } = props
  const containerRef = useRef(null)
  const [width, height] = useSize(containerRef)
  return (
    <Box ref={containerRef} position='relative' flex='1'>
      <Flex position='absolute' height={height} width={width} overflow='auto' {...props}>
        {children}
      </Flex>
    </Box>
  )
}

function TableMeta (props) {
  const { columns, uiState, dispatch, previewActive } = props
  const visible = columns.map(c => c.getToggleHiddenProps()).filter(x => x.checked).length
  const filters = columns.filter(c => c.filterValue !== undefined).length
  const sorts = columns.filter(c => c.isSorted).length
  debug('render meta: uistate %o', uiState)

  const togglePane = useCallback((name, state) => {
    let action
    if (state === undefined) action = 'toggle'
    else if (state) action = 'open'
    else action = 'close'
    const type = 'pane.' + action
    dispatch({ type, name })
  }, [])

  const shared = { state: uiState.pane, toggle: togglePane }
  const showPreview = uiState.pane.preview
  return (
    <Flex my={2}>
      <SimplePopover {...shared} header='Columns' badge={visible} icon={FaTable} name='cols'>
        <TableColumns columns={columns} />
      </SimplePopover>
      <SimplePopover {...shared} header='Filter' badge={filters} icon={FaFilter} name='filter'>
        <TableFilter columns={columns} addfilters={uiState.addfilters} dispatch={dispatch} />
      </SimplePopover>
      <SimplePopover {...shared} header='Sort' badge={sorts} icon={FaSortAlphaDown} name='sort'>
        <TableSort columns={columns} />
      </SimplePopover>
      <TableMetaButton ml={4} onClick={onTogglePreview} icon={IoMdEye} isOpen={showPreview}>
        { showPreview && 'Preview on select' }
        { !showPreview && 'No preview' }
      </TableMetaButton>
    </Flex>
  )
  function onTogglePreview (e) {
    console.log('dispatch!')
    dispatch({ type: 'pane.toggle', name: 'preview' })
  }
}

// A switch for the preview toggle?
// <Flex justify='center' align='center' bg='gray.100' rounded>
//   <FormLabel fontSize='sm' htmlFor='email-alerts'>Show preview?</FormLabel>
//   <Switch id='email-alerts' isChecked={showPreview} onChange={onTogglePreview} />
// </Flex>

function TableMetaButton (props) {
  const { icon, isOpen, children, badge, ...other } = props
  // TODO: add isActive prop for aria
  return (
    <Button
      leftIcon={icon}
      bg={isOpen ? 'yellow.300' : undefined}
      _hover={{ bg: isOpen ? 'yellow.400' : 'gray.200' }}
      size='sm'
      mr={[2, 4]}
      {...other}
    >
      {children}
      {badge !== undefined && (
        <Badge fontSize='sm' ml={2} variantColor={badge ? 'orange' : undefined}>{badge}</Badge>
      )}
    </Button>
  )
}

function SimplePopover (props) {
  const { children, icon, header, badge, name, state, toggle } = props
  const initialFocusRef = useRef()

  const popoverProps = {
    initialFocusRef,
    returnFocusOnClose: false,
    closeOnBlur: false,
    placement: 'bottom'
  }

  // TODO: Make the controlled mode optional again.
  // e.g. if state and toggle is unset, default to uncontrolled mode.
  const isOpen = state[name]
  popoverProps.isOpen = !!isOpen
  popoverProps.onClose = () => toggle(name, false)
  const triggerOnClick = e => toggle(name)

  return (
    <Fragment>
      <TableMetaButton icon={icon} isOpen={isOpen} onClick={triggerOnClick} badge={badge}>
        {header}
      </TableMetaButton>
      <Popover {...popoverProps}>
        <PopoverTrigger>
          <div style={{ position: 'relative', left: '-50px' }} />
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
      </Popover>
    </Fragment>
  )
}

function TableFilter (props) {
  const { columns, addfilters, dispatch } = props
  // const [newfilters, setNewfilters] = useState([])
  const filters = columns.filter(c => c.filterValue !== undefined)
  let autofocus = false
  addfilters
    .map(id => columns.find(c => c.id === id))
    .filter(c => filters.indexOf(c) === -1)
    .forEach(c => {
      filters.push(c)
      if (!autofocus) autofocus = c.id
    })

  const canFilters = columns.filter(c => c.filterValue === undefined && c.canFilter && filters.indexOf(c) === -1)
  let list
  if (!filters.length) {
    list = (
      <Text>No filters defined.</Text>
    )
  } else {
    list = filters.map(column => {
      let form = column.render('Filter')
      if (autofocus === column.id) form = <AutoFocusInside>{form}</AutoFocusInside>
      return (
        <Flex key={column.id} mb={2} align='center'>
          <FormLabel width='20rem' fontWeight='bold'>{column.render('Header')}</FormLabel>
          <Box flex={1}>{form}</Box>
        </Flex>
      )
    })
  }
  return (
    <Box>
      {list}
      <Box>
        <Select placeholder='Select a field to filter on' onChange={e => addFilter(e.target.value)}>
          {canFilters.map(c => <option key={c.id} value={c.id}>{c.render('Header')}</option>)}
        </Select>
      </Box>
    </Box>
  )

  function addFilter (id) {
    let col = columns.filter(c => c.id === id)[0]
    if (!col) return
    dispatch({ type: 'filter.add', data: id })
    // setNewfilters(f => [...f, col])
  }
}

function TableSort (props) {
  const { columns } = props
  const sorted = columns.filter(c => c.isSorted)
  return (
    <Box>
      {!sorted.length && 'No sorts active.'}
      {sorted.map(c => (
        <Flex key={c.id}>
          <Box w='20rem' flexGrow='0' p='2' fontWeight='bold'>{c.render('Header')}</Box>
          <Box p='2'>{c.isSortedDesc ? 'desc' : 'asc'}</Box>
          <Button onClick={e => c.clearSortBy()}>Remove</Button>
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

import React, { useMemo, useRef, useEffect, useState, forwardRef } from 'react'
// import Moment from 'react-moment'
import { VariableSizeList, FixedSizeList } from 'react-window'
import useSize from '../hooks/use-size'
import { useLocation, Link } from 'react-router-dom'

import { RecordLabelDisplay, RecordLink } from '../components/Record'

import { useQuery } from '@arsonar/react'

import {
  Box,
  Heading,
  Text
} from '@chakra-ui/core'

export default function ActivityPage (props) {
  const { data, error, pending } = useQuery('history', { reverse: true })
  return (
    <Box flex='1'>
      <Heading>Activity</Heading>
      <PagedActivityList records={data} />
    </Box>
  )
}

function PagedActivityList (props) {
  const { records } = props
  const query = useUrlQuery()
  const pageSize = 100
  let page = query.get('page') || 1
  page = parseInt(page)
  const pagedRecords = useMemo(() => {
    if (!records) return null
    const start = (page - 1) * pageSize
    const end = (page) * pageSize
    return records.slice(start, end)
  }, [records, page])
  if (!records) return null

  const pager = <Pager basepath='/activity' page={page} count={records.length} pageSize={pageSize} />
  return (
    <>
      {pager}
      <ActivityList records={pagedRecords} />
      {pager}
    </>
  )
}

function Pager (props) {
  const { page, pageSize, count, basepath } = props
  const pagecount = Math.ceil(count / pageSize)
  const pages = []
  for (let i = 1; i <= pagecount; i++) {
    pages.push(i)
  }
  return (
    <Box>
      {page > 1 && (
        <Link to={pagelink(page - 1)}>Previous</Link>
      )}
      {pages.map(cur => {
        const active = cur === page
        const fontWeight = active ? 'bold' : 'normal'
        return (
          <Link key={cur} to={pagelink(cur)}>
            <Text mx='2' display='inline' fontWeight={fontWeight}>
              {cur}
            </Text>
          </Link>
        )
      })}
      {((page + 1) <= pagecount) && (
        <Link to={pagelink(page + 1)}>Next</Link>
      )}
    </Box>
  )

  function pagelink (page) {
    return `${basepath}?page=${page}`
  }
}

function useUrlQuery () {
  return new URLSearchParams(useLocation().search)
}

function ActivityList (props) {
  const { records } = props
  if (!records || !records.length) return null
  return (
    <Box my='4'>
      {records.map((record, i) => (
        <Row record={record} key={i} />
      ))}
    </Box>
  )
}

function Row (props) {
  const { record } = props
  const date = new Date(record.timestamp)
  const formatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  // TODO: Fix
  return (
    <Box key={record.address} p='2' borderWidth='1px' mb='4'>
      {formatted}
      <Text as='em' ml='2' fontWeight='bold' color='text2'>#{record.lseq}</Text>
      &nbsp;
      <RecordLink record={record} />
    </Box>
  )
}

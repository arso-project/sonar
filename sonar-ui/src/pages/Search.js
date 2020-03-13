import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavLink from '../components/NavLink'

import makeGlobalStateHook from '../hooks/make-global-state-hook'

import client from '../lib/client'
import log from '../lib/log'

import Logger from '../components/Logger'
import { RecordLabelDisplay } from '../components/Record'
import { MetaItem, MetaItems } from '../components/MetaItem'

import {
  Box,
  Flex,
  Text,
  List,
  Input,
  Heading
} from '@chakra-ui/core'

export const useGlobalState = makeGlobalStateHook('search')

export function useSearchResults () {
  const [results, setResults] = useGlobalState('results', null)
  return results
}

export function SearchResultList (props) {
  const results = useSearchResults()
  return (
    <Box fontSize='sm'>
      <SearchInput size='sm' />
      {results && results.map((record, i) => (
        <Box key={i} borderBottomWidth='1px' p={1} my={1}>
          <NavLink to={recordPath(record.id)}>
            <RecordLabelDisplay record={record} />
          </NavLink>
        </Box>
      ))}
    </Box>
  )
}

export default function SearchPage (props) {
  const results = useSearchResults()
  return (
    <Box>
      <SearchInput />
      <SearchResults results={results} />
    </Box>
  )
}

export function SearchInput (props) {
  const [search, setSearch] = useGlobalState('search', '')
  const [error, setError] = useState(null)
  const [results, setResults] = useGlobalState('results', null)
  return (
    <React.Fragment>
      <Input
        type='text'
        value={search}
        onChange={onInputChange}
        placeholder='Type here to search'
        mb='4'
        {...props}
      />
      { error && <Logger error={error} />}
    </React.Fragment>
  )

  function onInputChange (e) {
    const search = e.target.value
    setSearch(search)
    client.search(search)
      .then(results => setResults(results))
      .catch(error => setError(error))
  }
}

export function SearchResults (props) {
  const { results } = props
  if (!results) return null
  // console.log('search results', results)
  return (
    <div className='sonar-search__list'>
      {results.map((row, i) => (
        <SearchResult key={i} row={row} />
      ))}
    </div>
  )
}

function SearchResult (props) {
  const { value, id, schema, key } = props.row
  return (
    <Box mb='4'>
      <Heading fontSize='md' color='pink.500'>{entityLink()}</Heading>
      <MetaItems>
        <MetaItem name='ID' value={id} />
        <MetaItem name='Schema' value={formatSchema(schema)} />
        <MetaItem name='Source' value={formatSource(key)} />
      </MetaItems>
      <div
        className='sonar-search__snippet'
        dangerouslySetInnerHTML={{ __html: value.snippet }}
      />
    </Box>
  )

  function entityLink () {
    const title = value.title || id
    return <Link to={recordPath(id)}>{title}</Link>
  }
}

function recordPath (id) {
  return '/record/' + id
}

// TODO: This is likely too hacky. Propably we'll want
// a full component with a tooltip for details.
function formatSchema (schemaName) {
  return schemaName.split('/').slice(1).join('/')
}

function formatSource (source) {
  return source.substring(0, 6)
}

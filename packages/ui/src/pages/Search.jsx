import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import NavLink from '../components/NavLink'

import makeGlobalStateHook from '../hooks/make-global-state-hook'

import Logger from '../components/Logger'
import { RecordLabelDisplay } from '../components/Record'
import { MetaItem, MetaItems } from '../components/MetaItem'

import { Box, Input, Heading } from '@chakra-ui/react'

import { useCollection } from '@arsonar/react'

export const useGlobalState = makeGlobalStateHook('search')

export function useSearchResults () {
  const [results] = useGlobalState('results', null)
  return results
}

export function SearchResultList (props) {
  const results = useSearchResults()
  return (
    <Box fontSize='sm'>
      <SearchInput size='sm' />
      {results &&
        results.map((record, i) => (
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
  const collection = useCollection()
  return (
    <>
      <Input
        type='text'
        value={search}
        onChange={onInputChange}
        placeholder='Type here to search'
        mb='4'
        {...props}
      />
      {error && <Logger error={error} />}
    </>
  )

  function onInputChange (e) {
    const search = e.target.value
    setSearch(search)
    collection
      .query('search', search)
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
  const { value, id, type, key } = props.row
  return (
    <Box mb='4'>
      <Heading fontSize='md' color='pink.500'>
        {entityLink()}
      </Heading>
      <MetaItems>
        <MetaItem name='ID' value={id} />
        <MetaItem name='Schema' value={formatType(type)} />
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
function formatType (typeName) {
  return typeName
    .split('/')
    .slice(1)
    .join('/')
}

function formatSource (source) {
  return source.substring(0, 6)
}

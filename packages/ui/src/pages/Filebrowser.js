import React, { useState, useEffect } from 'react'
import pretty from 'pretty-bytes'
import { formatDistance } from 'date-fns'
import { css } from '@emotion/core'
import { RecordDrawerByID } from '../components/Record'

import client from '../lib/client'

export default function Filebrowser (props) {
  const [path, setPath] = useState('')
  const [files, setFiles] = useState([])

  useEffect(() => {
    let mounted = true
    client
      .readdir(path)
      .then(files => (mounted && setFiles(files)))
    return () => (mounted = false)
  }, [path])

  const segments = path.split('/').filter(s => s)
  segments.unshift('/')

  return (
    <div css={sOuter}>
      {segments && (
        <div css={sBreadcrumb}>
          {segments.map((s, i) => (
            <span key={i} onClick={e => onSegmentClick(i, e)}>{s}</span>
          ))}
        </div>
      )}
      <ul css={sList}>
        {segments.length > 1 && (
          <li>
            <span>
              <a
                onClick={e => onSegmentClick(segments.length - 2, e)}
                href='/'
              >
                .. [up]
              </a>
            </span>
          </li>
        )}
        {files.map((file, i) => (
          <li key={i}>
            <span>
              <a
                target='_blank'
                rel='noopener noreferrer'
                href={file.link}
                onClick={e => onFileClick(file, e)}
              >
                {file.name}
              </a>
            </span>
            <span>
              {file.directory ? '–' : pretty(file.size)}
            </span>
            {file.resource && (
              <span>
                <RecordDrawerByID id={file.resource} />
              </span>
            )}
            {file.mtime && false && (
              <span>
                {formatDistance(Date.now(), file.mtime)} ago
              </span>
            )}
          </li>
        ))}
        {!files.length && <li><div><em>Nothing here</em></div></li>}
      </ul>
    </div>
  )

  function onFileClick (file, e) {
    if (file.directory) {
      e.preventDefault()
      setPath(path + '/' + file.name)
    }
  }

  function onSegmentClick (i, e) {
    e.preventDefault()
    const newPath = segments.slice(0, i + 1).join('/').substring(1)
    setPath(newPath)
  }
}

const sOuter = theme => css`
  --color-border: ${theme.colors.border1};
  --color-link: ${theme.colors.main};
  --color-bg-hover: ${theme.colors.bg2};
  font-size: 1.5rem;
  width: 100%;
`
const sList = css`
  border: 1px solid var(--color-border);
  border-radius: 2px;
  li {
    border-bottom: 1px solid var(--color-border);
    display: flex;
    &:last-child {
      border-bottom: none;
    }
  }
  span {
    width: 33%;
    padding: 1rem;
  }
  a {
    margin: -1rem;
    padding: 1rem;
    cursor: pointer;
    display: block;
    text-decoration: none;
    color: var(--color-primary);
    &:hover {
      background-color: var(--color-bg-hover);
    }
    &:focus {
      box-shadow: 0 0 3px hsla(var(--hue-focus), 70%, 50%, 90%);
    }
  }

  em {
    font-style: italic;
    color: #999
  }
`
const sBreadcrumb = css`
  font-weight: bold;
  margin: 0 0 1rem 0;
  > span {
    cursor: pointer;
    color: var(--color-primary);
    margin: 0 .5rem 0 0;
    padding: .25rem;
    position: relative;
    &:after {
      content: '/';
      color: var(--color-text-secondary);
      /* padding: 0 .5rem; */
      display: inline-block;
      position: relative;
      left: .5rem;
    }
    &:first-of-type,
    &:last-of-type {
      /* padding: 0 .5rem 0 0; */
      &:after {
        display: none;
      }
    }
    &:last-child {
      color: inherit;
    }
    &:not(:last-child):hover {
      border-radius: 5px;
      background-color: var(--color-bg-hover);
      text-decoration: underline;
    }
  }
`

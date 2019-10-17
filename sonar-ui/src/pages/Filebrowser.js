import React, { useState, useEffect } from 'react'
import pretty from 'pretty-bytes'
import { formatDistance } from 'date-fns'

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
    <div className='sonar-filebrowser'>
      {segments && (
        <div className='sonar-filebrowser__breadcrumb'>
          {segments.map((s, i) => (
            <span key={i} onClick={e => onSegmentClick(i, e)}>{s}</span>
          ))}
        </div>
      )}
      <ul className='sonar-filebrowser__list'>
        {segments.length > 1 && (
          <li>
            <a
              onClick={e => onSegmentClick(segments.length - 2, e)}
              href='/' // TODO: Parent link is not available here
            >
              .. [up]
            </a>
          </li>
        )}
        {files.map((file, i) => (
          <li key={i}>
            <a
              target='_blank'
              href={file.link}
              onClick={e => onFileClick(file, e)}
            >
              <span>
                {file.name}
              </span>
              <span>
                {file.directory ? '–' : pretty(file.size)}
              </span>
              <span>
                {formatDistance(Date.now(), file.mtime)} ago
              </span>
            </a>
          </li>
        ))}
        {!files.length && <li><div><em>Nothing here</em></div></li>}
      </ul>
    </div>
  )

  function onFileClick (file, e) {
    console.log('clicked', file)
    if (file.directory) {
      e.preventDefault()
      setPath(path + '/' + file.name)
    }
  }

  function onSegmentClick (i, e) {
    e.preventDefault()
    const newPath = segments.slice(0, i + 1).join('/')
    setPath(newPath)
  }
}

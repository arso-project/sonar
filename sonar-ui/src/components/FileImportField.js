import React, { useState } from 'react'
import filereaderStream from 'filereader-stream'
import { Transform } from 'stream'
import pretty from 'pretty-bytes'
import {
  Input,
  FormControl,
  FormLabel,
  Stack,
  Heading,
  Tooltip,
  Progress,
  FormErrorMessage,
  FormHelperText,
  Text,
  Button,
  Box,
  List,
  ListItem,
  ListIcon,
  Flex,
  Badge
} from '@chakra-ui/core'

import client from '../lib/client'

import {
  FaFileUpload
} from 'react-icons/fa'
import {
  MdError, MdCheck
} from 'react-icons/md'

function FileListItem(props) {
  const { name, resource, upload } = props

  function findIcon() {
    if (!resource) return <ListIcon icon={FaFileUpload} />
    if (resource.error) return <ListIcon icon={MdError} color='red.400' />
    if (!upload) return <ListIcon icon={MdCheck} color='green.400' />
    if (upload.isUploading) return <ListIcon icon={FaFileUpload} color='blue.400' />
    if (upload.error) return <ListIcon icon={MdError} color='red.400' />
    if (upload.uploaded) return <ListIcon icon={FaFileUpload} color='green.400' />
    return null
  }

  return (
    <ListItem>
      <Flex>
        <Box flex='1'> {findIcon()}{name}</Box>
          {resource &&(
          <Box>
            {resource.id && <Badge color='green.400'>{resource.id}</Badge>}
            {resource.error && 
            <Tooltip hasArrow label={resource.error} placement="top" bg="red.600">
<Badge color='red.400'>Error</Badge>
</Tooltip>}
          </Box>)}
      
      </Flex>
    </ListItem>
  )
}

function ImportProgress(props) {
  const { total = 0, transfered = 0, fileTotal = 0, fileTransfered = 0, name, step = 0, totalSteps = 0 } = props.progress

  return (
    <Box>
      Step {step} of {totalSteps}
      <FileProgress label='Total' total={total} transfered={transfered} />
      <FileProgress label='Current' total={fileTotal} transfered={fileTransfered} detail={name} />
    </Box>
  )
}

function FileProgress(props) {
  const { label, total, transfered, detail } = props
  return (
    <Box>
      <Heading fontSize='lg'>{label}</Heading>
      {detail && <em>{detail}</em>}
      <Flex>
        <Progress flex='1' value={total > 0 && (transfered / total) * 100} hasStripe />
        
      </Flex>
      <Badge variant="outline" variantColor="green">
    {pretty(transfered)} / {pretty(total)} 
  </Badge>
    </Box>
  )
}

export default function FileImportField(props) {
  const [files, setFiles] = useState({})
  const [uploads, setUploads] = useState({})
  const [resources, setResources] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({})

  const showImportButton = !!Object.values(resources).length
  return (
    <Box borderWidth='2px' m={4} p={4} rounded="lg">
      <FormControl m={3} p={2}>
        <FormLabel htmlFor='fileimport'>Import files</FormLabel>
        <Input
          id='fileimport'
          multiple
          type='file'
          aria-describedby='helper-text'
          onChange={onInputChange}
        />
        <FormHelperText id='helper-text'>
          choose files to import
        </FormHelperText>
      </FormControl>
      <List m={3} p={2}>
        {Object.values(files).map(function (file, index) {
          const { name } = file
          const upload = uploads[name]
          const resource = resources[name]
          console.log('resource', resource)
          return <FileListItem key={name} name={name} upload={upload} resource={resource} />
        })}
      </List>

      <Flex>
        <Button  m={2}variantColor='green' onClick={onCreateResources} isLoading={isLoading}>
          Create resources
        </Button>
        {showImportButton && (
          <Button m={2} variantColor='green' onClick={onImportFiles} isLoading={isLoading}>
            import files
          </Button>
        )}
      </Flex>
      <ImportProgress progress={progress} />
    </Box>
  )

  function onInputChange(event) {
    const fileList = event.target.files
    const files = {}
    for (let i = 0; i < fileList.length; i++) {
      const fileitem = fileList.item(i)
      const { name } = fileitem
      files[name] = { fileitem, name }
    }
    setFiles(files)
  }

  async function onCreateResources(event) {
    setIsLoading(true)
    const promises = []
    const results = {}
    Object.values(files).forEach(file => {
      const promise = createResource({
        filename: file.name,
        prefix: 'upload'
      })
        .then(
          resource => (results[file.name] =  resource ),
          error => (results[file.name] = { error: error.message })
        )
      promises.push(promise)
    })
    try {
      await Promise.all(promises)
      
    } catch (err) {}
    console.log('RESULTS', results)
    setResources(results)
    setIsLoading(false)
  }

  async function onImportFiles() {
    setIsLoading(true)

    const totalSteps = Object.values(files).length
    let total = 0
    for (const file of Object.values(files)) {
      total = total + file.fileitem.size
    }
    let transfered = 0
    let step = 1
    for (const file of Object.values(files)) {
      const { name, fileitem } = file
      const { size } = fileitem
      const resource= resources[name]
      console.log("RESULT IN ONIMPORTFILES", resource)

      if (!resource || !resource.id) continue

      let fileTransfered = 0

      setUploads(state => ({ ...state, [name]: { isUploading: true } }))

      const updater = setInterval(() => {
        setProgress({ transfered, fileTransfered, total, fileTotal: size, name, totalSteps, step })
      }, 200)

      try {
        const res = await client.writeResourceFile(resource, fileitem, {
          onUploadProgress(event) {
            const { loaded } = event
            fileTransfered = loaded
          }
          
        })
        console.log('import done', file.name, res)
      } catch (err) {
        console.log('import failed', file.name, err)
      }
      transfered = transfered + fileTransfered
      setUploads(state => ({ ...state, [name]: { isUploading: false, uploaded: true } }))
      setProgress({ transfered, fileTransfered, total, fileTotal: size, name, totalSteps, step })
      step = step + 1

      clearInterval(updater)
    }

    setIsLoading(false)
  }

  async function onDebugClick() {
    const file = files[0]
    if (!file) return
    console.log('file', file)
    const stream = filereaderStream(file)
    console.log('stream', stream)
    const res = await client.writeFile('sid/foo', stream)
    console.log('uploaded', res)
  }
}

async function createResource(props) {
  const { filename, prefix } = props
  const resource = await client.createResource({ filename, prefix })
  return resource
}


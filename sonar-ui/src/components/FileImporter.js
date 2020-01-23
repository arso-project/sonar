import React, { useState, useEffect } from 'react'
import filereaderStream from 'filereader-stream'
import pretty from 'pretty-bytes'
import mime from 'mime-types'
import { useClipboard, useDisclosure, useNumberInput, PseudoBox } from "@chakra-ui/core";
import {
  Input,
  FormControl,
  FormLabel,
  Stack,
  useToast,
  Heading,
  AlertIcon,
  Alert,
  Tooltip,
  Progress,
  FormErrorMessage,
  FormHelperText,
  Text,
  Button,
  Box,
  List,
  Link,
  ListItem,
  ListIcon,
  Flex,
  Grid,
  Badge,
  Spinner,
 
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/core";
import { RecordGroup, RecordDrawerByID } from '../components/Record'
import client from '../lib/client'
import { useRecordData } from '../hooks/use-data'

import {
  FaFileUpload
} from 'react-icons/fa'
import {
  MdError, MdCheck
} from 'react-icons/md'

function FileListItem(props) {
  const { name, resource, upload } = props
  const keyRegex = /[aA-zZ0-9]{26}/
  
  function findIcon() {
    if (!resource) return <ListIcon icon={FaFileUpload} />
    if (resource.error) return <ListIcon icon={MdError} color='red.400' />
    if (!upload) return <ListIcon icon={MdCheck} color='green.400' />
    if (upload.isUploading) return <Spinner></Spinner>
    if (upload.error) return <ListIcon icon={MdError} color='red.400' />
    if (upload.uploaded) return <ListIcon icon="check-circle" color='green.400' />
    return null
  }

  return (
    <ListItem>
      <Flex>
        <Box flex='1'> {findIcon()}{name}</Box>
        {resource && (
          <Box>
            {resource.id &&
              <RecordDrawerByID id={resource.id}/>
                        }   
            {resource.error &&
              <Tooltip hasArrow label={resource.error} placement="top" bg="orange.400">
                <Badge color='orange.400'>{resource.error.match(keyRegex) || "Error"}</Badge>
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


export default function FileImporter(props) {
  const [files, setFiles] = useState({})
  const [uploads, setUploads] = useState({})
  const [resources, setResources] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({})
  const [final, setFinal] = useState(false)
  const toast = useToast()
  const showImportButton = !!Object.values(resources).length
  let showClearButton = final
  let buttonDisabled = final
  return (
    <Box borderWidth='2px' m={4} p={4} rounded="lg">
      <h2>File Importer</h2>
      <FormControl m={3} p={2}>
        <Input
          id='fileimport'
          multiple
          type='file'
          onChange={onInputChange}
        />
      </FormControl>

      <List m={3} p={2}>
        {Object.values(files).map(function (file, index) {
          const { name } = file
          const upload = uploads[name]
          const resource = resources[name]
          return <FileListItem key={name} name={name} upload={upload} resource={resource} />
        })}
      </List>

      <Flex>
        <Button m={2} variantColor='green' isDisabled={buttonDisabled} onClick={onCreateResources} isLoading={isLoading}>
          Create resources
        </Button>
        {showImportButton && (
          <Button m={2} variantColor='green' isDisabled={buttonDisabled} onClick={onImportFiles} isLoading={isLoading}>
            import files
          </Button>
        )}
        {showClearButton && <Button m={2} variantColor='green' onClick={onClear} isLoading={isLoading}>
          clear
          </Button>}
      </Flex>
      <ImportProgress progress={progress} />
      {final && <PseudoBox>{toast(showImportMessage())}</PseudoBox>}
    </Box>
  )
  function onClear() {
    setFiles({})
    setFinal(false)
    setResources({})
    setUploads({})
    setProgress({})

  }
  function showImportMessage() {
    let status = "success"
    let title = "Yeahhh"
    const numImportedFiles = Object.values(uploads).length
    if (numImportedFiles < 1) {
      status = "warning"
      title = "Ouhhhh"
    }
    return {
      title: title,
      description: numImportedFiles + " files imported",
      status: status,
      duration: 9000,
      isClosable: true
    }
  }

  function onInputChange(event) {
    if (final) {
      onClear()
    }
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
        prefix: 'upload',
        encodingFormat: mime.lookup(file.name),
        contentSize: file.fileitem.size,
        label: file.name
      })
        .then(
          resource => (results[file.name] = resource),
          error => (results[file.name] = { error: error.message })
        )
      promises.push(promise)
    })
    try {
      await Promise.all(promises)
    } catch (err) { }
    setResources(results)
    setIsLoading(false)
  }

  async function onImportFiles() {
    setIsLoading(true)

    let totalSteps = 0
    let total = 0
    for (const file of Object.values(files)) {
      const resource = resources[file.name]
      if (!resource.error) {
        totalSteps++
        total = total + file.fileitem.size
      }
    }
    let transfered = 0
    let step = 1
    for (const file of Object.values(files)) {
      const { name, fileitem } = file
      const { size } = fileitem
      const resource = resources[name]

      if (!resource || !resource.id || uploads[file.name]) continue

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
    setFinal(true)

  }
}

async function createResource(props, opts) {
  const { filename, prefix, contentSize, encodingFormat, label } = props
  const resource = await client.createResource({ filename, prefix, contentSize, encodingFormat, label }, opts)
  return resource
}

// TODO: relocate fetchRecordData useRecorddata



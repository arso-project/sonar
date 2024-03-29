import React, { useState, useEffect } from 'react'
import pretty from 'pretty-bytes'
import mime from 'mime-types'
import {
  Text,
  FormControl,
  useToast,
  Heading,
  Tooltip,
  Progress,
  Button,
  Box,
  List,
  ListItem,
  Flex,
  Badge,
  Spinner
} from '@chakra-ui/react'

import { RecordDrawerByID } from '../components/Record'

import { FaFileUpload } from 'react-icons/fa'
import { MdError, MdCheck, MdCheckCircle } from 'react-icons/md'
import { useCollection } from '@arsonar/react'

function FileInput (props) {
  const { onInputChange } = props
  let hiddenInput
  return (
    <FormControl my={4}>
      <Button leftIcon={<FaFileUpload />} onClick={e => hiddenInput.click()}>
        Select files
      </Button>
      <input
        hidden
        ref={el => (hiddenInput = el)}
        id='fileimport'
        multiple
        type='file'
        onChange={onInputChange}
      />
    </FormControl>
  )
}

function FileList (props) {
  const { files, records, uploads } = props
  return (
    <List my={3} borderWidth='1px'>
      {Object.values(files).map(function (file, index) {
        const { name } = file
        const upload = uploads[name]
        const record = records[name]
        const bg = index % 2 === 0 ? undefined : 'bg1'
        return (
          <Box bg={bg} p='1' key={name}>
            <FileListItem name={name} upload={upload} record={record} />
          </Box>
        )
      })}
    </List>
  )
}

function Icon (props) {
  const { icon, ...other } = props
  return <Box as={icon} size='1em' {...other} />
}

function FileListItem (props) {
  const { name, record, upload } = props
  const keyRegex = /[aA-zZ0-9]{26}/

  function findIcon () {
    if (!record) return <Icon icon={FaFileUpload} />
    if (record.error) return <Icon icon={MdError} color='red.400' />
    if (!upload) return <Icon icon={MdCheck} color='green.400' />
    if (upload.isUploading) return <Spinner size='xs' color='green.400' />
    if (upload.error) return <Icon icon={MdError} color='red.400' />
    if (upload.uploaded) return <Icon icon={MdCheckCircle} color='green.400' />
    return null
  }

  return (
    <ListItem display='flex' alignItems='start'>
      <Box mt={1} mr={2}>
        {findIcon()}
      </Box>
      <Box display={{ md: 'flex' }} flex='1'>
        <Box flex='1' mr={{ md: 3 }}>
          {name}
        </Box>
        {record && (
          <Box>
            {record.id}
            {record.id && <RecordDrawerByID id={record.id} />}
            {record.error && (
              <Tooltip
                hasArrow
                label={record.error}
                placement='top'
                bg='orange.400'
              >
                <Badge color='orange.400'>
                  {record.error.match(keyRegex) || 'Error'}
                </Badge>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
    </ListItem>
  )
}

function ImportProgress (props) {
  const {
    total = 0,
    transfered = 0,
    fileTotal = 0,
    fileTransfered = 0,
    name,
    step = 0,
    totalSteps = 0
  } = props.progress
  return (
    <Box>
      <FileProgress
        label='Total'
        total={total}
        transfered={transfered}
        step={step}
        totalSteps={totalSteps}
      />
      <FileProgress
        label='Current'
        total={fileTotal}
        transfered={fileTransfered}
        detail={name}
      />
    </Box>
  )
}

function FileProgress (props) {
  const { label, total, transfered, detail, step, totalSteps } = props
  const showSteps = step > 0
  return (
    <Box mb='2' p='2' borderWidth='1px'>
      <Heading
        w='12em'
        mb='1'
        fontWeight='semibold'
        color='text1'
        fontSize='sm'
      >
        {label}
      </Heading>

      <Progress
        flex='1'
        value={total > 0 && (transfered / total) * 100}
        hasStripe
      />
      {detail && (
        <Text fontSize='sm' as='em'>
          {detail}
        </Text>
      )}
      <Box display={{ md: 'flex' }} mt='2'>
        <Badge variant='outline' mr={{ md: 2 }}>
          {pretty(transfered)} / {pretty(total)}
        </Badge>
        {showSteps && (
          <Badge variant='outline'>
            {step} of {totalSteps}
          </Badge>
        )}
      </Box>
    </Box>
  )
}

export default function FileImporter (props) {
  const collection = useCollection()
  const [files, setFiles] = useState({})
  const [uploads, setUploads] = useState({})
  const [records, setRecords] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({})
  const [final, setFinal] = useState(false)
  const toast = useToast()
  const hasFiles = !!Object.values(files).length
  const showClearButton = final
  const buttonDisabled = final

  useEffect(() => {
    if (final) toast(showImportMessage())
  }, [final])

  if (!collection) return null

  console.log({ files, records })

  return (
    <Box w='100%'>
      <Heading>Import files</Heading>
      <FileInput onInputChange={onInputChange} />
      {hasFiles && (
        <FileList files={files} uploads={uploads} records={records} />
      )}
      <Flex>
        {hasFiles && (
          <Button
            my={2}
            mr='2'
            isDisabled={buttonDisabled}
            onClick={onUploadClick}
            isLoading={isLoading}
          >
            Upload
          </Button>
        )}
        {showClearButton && (
          <Button m={2} variant='ghost' onClick={onClear} isLoading={isLoading}>
            Clear
          </Button>
        )}
      </Flex>
      <ImportProgress progress={progress} />
    </Box>
  )
  function onClear () {
    setFiles({})
    setFinal(false)
    setRecords({})
    setUploads({})
    setProgress({})
  }
  function showImportMessage () {
    let status = 'success'
    let title = 'Yeahhh'
    const numImportedFiles = Object.values(uploads).length
    if (numImportedFiles < 1) {
      status = 'warning'
      title = 'Ouhhhh'
    }
    return {
      title: title,
      description: numImportedFiles + ' files imported',
      status: status,
      duration: 9000,
      isClosable: true
    }
  }

  function onInputChange (event) {
    if (final) {
      onClear()
    }
    let total = 0
    const fileList = event.target.files
    const files = {}
    for (let i = 0; i < fileList.length; i++) {
      const fileitem = fileList.item(i)
      total += fileitem.size
      const { name } = fileitem
      files[name] = { fileitem, name }
    }

    setFiles(files)
    setProgress({ total })
  }

  // async function onUploadClick (event) {
  //   setIsLoading(true)
  //   const results = {}
  //   const promises = Object.values(files).map(file => {
  //     return collection.files.createFile(file, {
  //       filename: file.name,
  //       label: file.name,
  //       encodingFormat: mime.lookup(file.name),
  //       contentSize: file.fileitem.size
  //     }).then(
  //       file => (results[file.name] = file),
  //       error => (results[file.name] = { error: error.message })
  //     )
  //   })
  //   try {
  //     await Promise.all(promises)
  //   } catch (err) {}
  //   setFileRecords(results)
  //   setIsLoading(false)
  // }

  async function onUploadClick () {
    setIsLoading(true)
    let totalSteps = 0
    let total = 0
    for (const file of Object.values(files)) {
      totalSteps++
      total = total + file.fileitem.size
    }
    let transfered = 0
    let step = 1

    for (const file of Object.values(files)) {
      const { name, fileitem } = file
      const { size } = fileitem
      let fileTransfered = 0

      setUploads(state => ({ ...state, [name]: { isUploading: true } }))

      const updater = setInterval(() => {
        setProgress({
          transfered,
          fileTransfered,
          total,
          fileTotal: size,
          name,
          totalSteps,
          step
        })
      }, 200)

      try {
        console.log('start upload', file)
        const record = await collection.files.createFile(file.fileitem, {
          filename: file.name,
          label: file.name,
          encodingFormat: file.fileitem.type,
          // encodingFormat: mime.lookup(file.name),
          contentSize: file.fileitem.size
        }, {
          onUploadProgress (event) {
            const { loaded } = event
            fileTransfered = loaded
          }
        })
        setRecords({ ...records, [file.name]: record })
        console.log('finished upload', file, record)
      } catch (err) {
        setRecords({ ...records, [file.name]: { error: err } })
        console.log('import failed', file, err)
      }
      transfered = transfered + fileTransfered
      setUploads(state => ({
        ...state,
        [name]: { isUploading: false, uploaded: true }
      }))
      setProgress({
        transfered,
        fileTransfered,
        total,
        fileTotal: size,
        name,
        totalSteps,
        step
      })
      step = step + 1

      clearInterval(updater)
    }

    setIsLoading(false)
    setFinal(true)
  }
}

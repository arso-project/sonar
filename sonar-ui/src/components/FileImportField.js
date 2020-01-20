import React, {useState} from 'react'
import {
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Button,
  Box,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/core'

import client from '../lib/client'
import { MetaItems } from './MetaItem'

export default function FileImportField (props) {
    const [files, setFiles] = useState([])
    return (
        <Box>
        <FormControl m={3} p={2}>
        <FormLabel htmlFor="fileimport">Import file</FormLabel>
        <Input 
            id = 'fileimport' 
            multiple 
            type = 'file' 
            aria-describedby="helper-text"
            onChange = {
                event => {
                    let filearr = []
                    const fileList = event.target.files
                    for (let i = 0; i < fileList.length; i++){
                        filearr.push(fileList.item(i))   
                    }
                    setFiles(
                        [...files,...filearr].reduce((x, y) => x.findIndex(e=>e.name==y.name)<0 ? [...x, y]: x, [])
                    )
                    console.log(files)      
            }
        }
        />
        <FormHelperText id="email-helper-text">
    chose files to import
        </FormHelperText>
        </FormControl>
    <h2>Files to import:</h2>
        <List m={3} p={2}>
      {files.map(function (file, index) {
        return (<ListItem key = {index}><ListIcon icon="check-circle" color="green.500" />{file.name}</ListItem>)
      })}
    </List>

        <Button variantColor="green" onClick={
            event => {
                event.preventDefault()
                files.forEach(file => importFile ({
                    filename: file.name,
                    prefix: 'upload'
                }))
            }
        }>create Resource</Button>
        </Box>
    )
}

async function importFile (props) {
    const {filename, prefix} = props
    console.log(prefix + '/' + filename)
    const id = await client.createResource({filename, prefix})
    console.log(id)

}
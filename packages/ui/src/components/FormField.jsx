import React from 'react'
import {
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText
} from '@chakra-ui/react'

export default function FormField (props) {
  const { name, title, help, error } = props
  let helpid = help ? `${name}-helper-text` : undefined
  let input
  if (props.input) {
    input = props.input({
      name,
      'aria-describedby': helpid
    })
  } else {
    input = <Input type='text' id={name} aria-describedby={helpid} {...props} />
  }
  return (
    <FormControl key={name} mb={4} isInvalid={!!error}>
      {title && <FormLabel htmlFor={name}>{title}</FormLabel>}
      {input}
      {error && <FormErrorMessage>{error}</FormErrorMessage>}
      {help && (
        <FormHelperText id={helpid}>
          {help}
        </FormHelperText>
      )}
    </FormControl>
  )
}

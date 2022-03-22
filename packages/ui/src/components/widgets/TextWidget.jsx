import React, { useRef, useEffect } from 'react'

import { Input, FormControl, FormLabel, FormHelperText } from '@chakra-ui/react'

export default function TextWidget (props) {
  const { field, register } = props
  const ref = useRef()
  useRegisterWidget(props, () => {
    return ref.current.value
  })
  return (
    <FormControl>
      <FormLabel htmlFor={field.name}>{field.name}</FormLabel>
      <Input
        ref={ref}
        id={field.name}
        aria-describedby={field.name + '-helper-text'}
      />
      <FormHelperText id={field.name + '-helper-text'}>
        {field.address}
      </FormHelperText>
    </FormControl>
  )
}

function useRegisterWidget (props, onSubmit) {
  const { register } = props
  useEffect(() => {
    register(onSubmit)
  }, [])
}

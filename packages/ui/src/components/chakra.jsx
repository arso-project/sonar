import { Button as _Button } from '@chakra-ui/core'

export const Button = Object.assign(_Button, {
  defaultProps: {
    ..._Button.defaultProps,
    transition: 'none'
  }
})

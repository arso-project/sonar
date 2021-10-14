import React, { Fragment } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useRouteMatch } from 'react-router'

import {
  Link
} from '@chakra-ui/core'

export default function MenuLink (props) {
  const active = useRouteMatch({
    path: props.to,
    exact: props.exact
  })

  return (
    <Link
      as={RouterLink}
      aria-current={active ? 'page' : null}
      color={active ? 'pink.500' : undefined}
      display='block'
      {...props}
    />
  )
}

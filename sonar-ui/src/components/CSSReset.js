import { css, Global } from '@emotion/core'
import { CSSReset as ChakraCSSReset } from '@chakra-ui/core'
import React, { Fragment } from 'react'

export default function CSSReset (props) {
  return (
    <Fragment>
      <ChakraCSSReset />
      <Global styles={styles} />
    </Fragment>
  )
}

const styles = css`
  // Remove the dotted focus line around options in Firefox.
  select:-moz-focusring {
    color: transparent;
    text-shadow: 0 0 0 #000;
  }
  select:-moz-focusring * {
    color: #000;
    text-shadow: none;
  }
`

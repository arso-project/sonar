import { css, Global } from '@emotion/react'
import { CSSReset as ChakraCSSReset } from '@chakra-ui/react'
import React, { Fragment } from 'react'

export default function CSSReset (props) {
  return (
    <>
      <ChakraCSSReset />
      <Global styles={styles} />
    </>
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

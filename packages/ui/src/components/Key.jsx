import React, { useState } from 'react'
import { Button, Flex, Icon, Box, useClipboard, Badge } from '@chakra-ui/react'

function KeyButton (props) {
  const { children, ...other } = props
  return (
    <Button
      size='sm'
      border='1px'
      p='2'
      pb='1'
      my='1'
      height='1.5rem'
      cursor='copy'
      rightIcon='copy'
      fontFamily='mono'
      fontWeight='semibold'
      lineHeight='none'
      rounded='2px'
      bg='bg2'
      borderColor='#ccd0d5'
      color='text1'
      _hover={{ bg: 'bg1' }}
      _active={{ bg: 'bg1' }}
      {...other}
    >
      {children}
    </Button>
  )
}

export default function Key (props) {
  const { k: key } = props
  const shortkey = formatKey(key)
  const { onCopy, hasCopied } = useClipboard(key)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)

  const showCopy = hover || focus
  const showBadge = showCopy || hasCopied

  return (
    <Flex direction='row' justify='space-between'>
      <KeyButton
        onClick={onCopy}
        onMouseEnter={e => setHover(true)}
        onMouseLeave={e => setHover(false)}
        onFocus={e => setFocus(true)}
        onBlur={e => setFocus(false)}
      >
        {shortkey}
      </KeyButton>
      {showBadge && (
        <Box ml='2'>
          <Badge
            colorScheme={hasCopied ? 'green' : undefined}
            textTransform='0'
          >
            <Flex direction='row' justify='space-around'>
              {hasCopied && (
                <Flex direction='row' justify='space-around'>
                  <Box flex='0' mr='1'>
                    <Icon name='check-circle' />
                  </Box>
                  <Box>Copied</Box>
                </Flex>
              )}
              {!hasCopied && showCopy && <Box>Click to copy</Box>}
            </Flex>
          </Badge>
        </Box>
      )}
    </Flex>
  )
}

function formatKey (key) {
  if (!key) return 'n/a'
  return key.substring(0, 5) + '..' + key.substring(key.length - 2)
}

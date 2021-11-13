import React, { useReducer } from 'react'
import {
  Box, Flex, Badge, Text, Icon, Image,
  FormControl, FormLabel, Input, FormHelperText
} from '@chakra-ui/react'
// import css from '@emotion/css'

const initialState = { play: 'stop' }

function reducer (state, action) {
  const x = s => ({ ...state, ...s })
  if (action === 'play') {
    return x({ play: 'play' })
  }
  if (action === 'pause') {
    if (state.play === 'stop') return state
    return x({ play: 'pause' })
  }
  if (action === 'playpause') {
    if (state.play === 'stop') return x({ play: 'play' })
    if (state.play === 'pause') return x({ play: 'play' })
    return x({ play: 'pause' })
  }
  if (action === 'stop') {
    return x({ play: 'stop' })
  }
  if (action === 'fullscreen') {
    return x({ fullscreen: !state.fullscreen })
  }
}

export default function Player () {
  const [state, dispatch] = useReducer(reducer, initialState)
  let style = {}
  if (state.fullscreen) {
    style = {
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      right: 0,
      zIndex: 1000
    }
  }
  const size = '10px'
  return (
    <Flex direction='column' bg='black' w='100%' textAlign='center' contentAlign='center' style={style}>
      <Flex flex={1}>
        <Text fontSize='xl' color='green.400' p='10px'>{state.play}</Text>
      </Flex>
      <Flex flexBasis='100px' m={size}>
        <PButton onClick={e => dispatch('play')} active={state.play === 'play'}>Play</PButton>
        <PButton onClick={e => dispatch('pause')} active={state.play === 'pause'}>Pause</PButton>
        <PButton onClick={e => dispatch('playpause')} active={state.play === 'play'}>Playpause</PButton>
        <PButton onClick={e => dispatch('stop')} active={state.play === 'stop'}>Stop</PButton>
        <Box flex={1} />
        <PButton onClick={e => dispatch('fullscreen')} active={state.fullscreen}>Fullscreen</PButton>
      </Flex>
    </Flex>
  )
}

function PButton (props) {
  const { children, active, ...other } = props
  const size = '100px'
  other.bg = active ? 'green.400' : 'red.400'
  other._hover = { boxShadow: '0 0 10px 2px rgba(255, 50, 200, 0.7)' }
  return (
    <Box as='button' w={size} h={size} mr='10px' {...other}>
      {children}
    </Box>
  )
}

import React, { Fragment } from 'react'
import NavLink from '../components/NavLink'

import {
  Box,
  Heading,
  List
} from '@chakra-ui/core'

import config from '../lib/config'

const group = config.get('group')

export function SidebarContent (props) {
  return (
    <Fragment>
      <List>
        <NavLink exact to='/'>Start</NavLink>
        <NavLink to='/config'>Config</NavLink>
        <NavLink to='/groups'>Groups</NavLink>
        {group && (
          <Fragment>
            <MenuHeading>{group.substring(0, 6)}</MenuHeading>
            <NavLink to='/search'>Search</NavLink>
            <NavLink to='/fileimport'>Import files</NavLink>
            <NavLink to='/filebrowser'>Filebrowser</NavLink>
            <NavLink to='/tables'>Tables</NavLink>
          </Fragment>
        )}
      </List>
    </Fragment>
  )
}

function MenuHeading (props) {
  return (
    <Heading
      fontSize='s'
      color='teal.300'
      letterSpacing='wide'
      my={2}
      {...props}
    />
  )
}

export default function Sidebar (props) {
  return (
    <SideNavContainer {...props}>
      <Box
        position='relative'
        overflowY='auto'
        p={4}
      >
        <SidebarContent />
      </Box>
    </SideNavContainer>
  )
}

function SideNavContainer (props) {
  return (
    <Box
      position='fixed'
      left='0'
      width='100%'
      height='100%'
      top='0'
      right='0'
      borderRightWidth='1px'
      {...props}
    />
  )
}

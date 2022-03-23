import React, { Fragment } from 'react'
import NavLink from '../components/NavLink'

import { Box, Heading, List } from '@chakra-ui/react'

import { CollectionName } from '../components/Collection'

import { useCollection } from '@arsonar/react'

export function SidebarContent (props) {
  const collection = useCollection()
  return (
    <>
      <List>
        <NavLink exact to='/'>
          Start
        </NavLink>
        <NavLink to='/config'>Config</NavLink>
        <NavLink to='/collections'>Collections</NavLink>
        {collection && <CollectionMenu />}
      </List>
    </>
  )
}

function CollectionMenu (props) {
  return (
    <>
      <MenuHeading>
        <CollectionName />
      </MenuHeading>
      <NavLink to='/activity'>Activity</NavLink>
      <NavLink to='/search'>Search</NavLink>
      <NavLink to='/fileimport'>Import files</NavLink>
      <NavLink to='/filebrowser'>Filebrowser</NavLink>
      <NavLink to='/tables'>Tables</NavLink>
    </>
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
      <Box position='relative' overflowY='auto' p={4}>
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

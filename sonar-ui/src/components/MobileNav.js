import {
  Drawer,
  DrawerBody,
  IconButton,
  useDisclosure,
  DrawerOverlay,
  DrawerContent
} from '@chakra-ui/core'
import React, { useEffect } from 'react'
import { MdDehaze } from 'react-icons/md'
import { SidebarContent } from './Sidebar'

function MobileNav (props) {
  const { isOpen, onToggle, onClose } = useDisclosure()

  return (
    <>
      <IconButton
        display={{ sm: 'inline-flex', md: 'none' }}
        aria-label='Navigation Menu'
        fontSize='20px'
        variant='ghost'
        icon={MdDehaze}
        onClick={onToggle}
      />
      <Drawer size='xs' isOpen={isOpen} placement='left' onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerBody p={4}>
            <SidebarContent contentHeight='100vh' top='0' />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default MobileNav

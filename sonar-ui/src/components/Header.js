import React, { Fragment } from 'react'
import { FaRegListAlt } from 'react-icons/fa'
import { MdHelpOutline as HelpIcon } from 'react-icons/md'
import {
  ThemeProvider,
  ColorModeProvider,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuDivider,
  MenuOptionGroup,
  MenuItemOption,
  Flex,
  Heading,
  IconButton,
  Button,
  // Text,
  useColorMode,
  useDisclosure
} from '@chakra-ui/core'
import MobileNav from './MobileNav'
import LogModal from './LogModal'

export default function Header (props) {
  const { colorMode, toggleColorMode } = useColorMode()
  const bg = { light: 'white', dark: 'gray.800' }
  return (
    <Box
      pos='fixed'
      as='header'
      top='0'
      zIndex='4'
      bg={bg[colorMode]}
      left='0'
      right='0'
      borderBottomWidth='1px'
      width='full'
      height='2rem'
      {...props}
    >
      <Flex size='100%' px='4' align='center'>
        <Heading
          fontSize='md'
          color='teal.400'
          letterSpacing='wide'
          mr={2}
          my={1}
          textTransform='uppercase'
        >
        Sonar
        </Heading>

        <Flex flex='1' />

        <HelpMenu />
        <LogButton />
        <IconButton
          aria-label={`Switch to ${
            colorMode === 'light' ? 'dark' : 'light'
          } mode`}
          variant='ghost'
          color='current'
          ml='2'
          fontSize='md'
          height='2rem'
          onClick={toggleColorMode}
          icon={colorMode === 'light' ? 'moon' : 'sun'}
        />
        <MobileNav />
      </Flex>
    </Box>
  )
}

const headerButtonProps = {
  variant: 'ghost',
  color: 'current',
  ml: '2',
  fontSize: 'md',
  height: '2rem'
}

const HeaderIconButton = Object.assign(IconButton, {
  defaultProps: {
    ...IconButton.defaultProps,
    ...headerButtonProps
  }
})

const HeaderButton = Object.assign(Button, {
  defaultProps: {
    ...IconButton.defaultProps,
    ...headerButtonProps
  }
})

function HelpMenu (props) {
  return (
    <Menu>
      <MenuButton as={HeaderButton} leftIcon={HelpIcon}>
        Docs
      </MenuButton>
      <MenuList>
        <MenuItem as='a' href='/api-docs-client' target='_blank'>
          Javascript API docs
        </MenuItem>
        <MenuItem as='a' href='/api-docs' target='_blank'>
          HTTP API docs
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function LogButton (props) {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <HeaderIconButton
        aria-label='Show log'
        onClick={onOpen}
        icon={FaRegListAlt}
        {...props}
      />
      <LogModal isOpen={isOpen} onClose={onClose} />
    </>
  )
}

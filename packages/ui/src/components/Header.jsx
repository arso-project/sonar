import React, { Fragment } from 'react'
import { FaRegListAlt, FaMoon, FaSun } from 'react-icons/fa'
import { MdHelp as HelpIcon } from 'react-icons/md'
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
} from '@chakra-ui/react'
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
          icon={colorMode === 'light' ? <FaMoon /> : <FaSun />}
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

const HeaderIconButton = React.forwardRef((props, ref) => {
  return (
    <IconButton
      {...headerButtonProps}
      ref={ref}
      {...props}
    />
  )
})

const HeaderButton = React.forwardRef((props, ref) => {
  return (
    <Button
      {...headerButtonProps}
      ref={ref}
      {...props}
    />
  )
})

function HelpMenu (props) {
  return (
    <Menu>
      <MenuButton as={HeaderButton} leftIcon={<HelpIcon />}>
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
        icon={<FaRegListAlt />}
        {...props}
      />
      <LogModal isOpen={isOpen} onClose={onClose} />
    </>
  )
}

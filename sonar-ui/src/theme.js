import { theme } from '@chakra-ui/core'

console.log(theme)

// Let's say you want to add custom colors
const sonarTheme = {
  ...theme,
  colors: {
    ...theme.colors
  }
}

export default sonarTheme

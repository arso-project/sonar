import { theme } from '@chakra-ui/core'

// Let's say you want to add custom colors
const sonarTheme = {
  ...theme,
  colors: {
    ...theme.colors,
    main: theme.colors.cyan
  }
}

export default sonarTheme

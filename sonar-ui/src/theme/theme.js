import { theme } from '@chakra-ui/core'

// Let's say you want to add custom colors
const sonarTheme = {
  ...theme,
  shadows: {
    ...theme.shadows,
    outline: '0 0 0 3px rgba(66, 153, 160, 0.5)'
  },
  colors: {
    ...theme.colors,
    main: theme.colors.cyan
  }
}

export default sonarTheme

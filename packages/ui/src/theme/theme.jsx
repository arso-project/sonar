import { theme as chakra } from '@chakra-ui/core'
// console.log('chakra', chakra)
// Let's say you want to add custom colors
export default function createTheme (colorMode) {
  const light = colorMode === 'light'
  const lums = [
    light ? 900 : 50,
    light ? 700 : 300,
    light ? 500 : 500
  ]

  const theme = {
    ...chakra,
    shadows: {
      ...chakra.shadows,
      outline: '0 0 0 3px rgba(66, 153, 160, 0.5)'
    },
    colors: {
      ...chakra.colors,
      main: chakra.colors.teal['400'],
      text0: light ? chakra.colors.black : chakra.colors.white,
      text1: chakra.colors.gray[lums[1]],
      text2: chakra.colors.gray[lums[2]],
      bg0: light ? chakra.colors.gray['200'] : chakra.colors.gray['600'],
      bg1: light ? chakra.colors.gray['100'] : chakra.colors.gray['700'],
      bg2: light ? chakra.colors.gray['50'] : chakra.colors.gray['800'],
      border1: chakra.colors.gray['400'],
      border2: chakra.colors.gray['300'],
      border3: chakra.colors.gray['200']
    }
  }
  return theme
}

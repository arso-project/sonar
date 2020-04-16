module.exports = {
  port: {
    alias: 'p',
    number: true,
    describe: 'port',
    default: 9191
  },
  hostname: {
    alias: 'h',
    describe: 'hostname',
    default: 'localhost'
  },
  storage: {
    alias: 's',
    describe: 'the storage path',
    default: null
  },
  dev: {
    describe: 'start in developer\'s mode'
  }
}

const debug = require('debug')('sonar-core')
const { clock } = require('./util')

const log = {
  trace: (...args) => debug(...args),
  debug: (...args) => debug(...args),
  info: (...args) => console.log(...args),
  warning: (...args) => console.error(...args),
  error: (...args) => console.error(...args)
}

module.exports = log
module.exports.child = () => log
module.exports.clock = clock

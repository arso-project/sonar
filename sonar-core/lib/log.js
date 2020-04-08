const debug = require('debug')('sonar-core')

const log = {
  info: (...args) => debug(...args),
  debug: (...args) => debug(...args),
  error: (...args) => debug(...args)
}

module.exports = log
module.exports.child = () => log
module.exports.clock = clock

function clock () {
  const [ss, sn] = process.hrtime()
  return () => {
    const [ds, dn] = process.hrtime([ss, sn])
    const ns = (ds * 1e9) + dn
    const ms = round(ns / 1e6)
    const s = round(ms / 1e3)
    if (s >= 1) return s + 's'
    if (ms >= 0.01) return ms + 'ms'
    if (ns) return ns + 'ns'
  }
}

function round (num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

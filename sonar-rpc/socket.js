const os = require('os')

function getSocketPath (name) {
  name = name || 'sonar-rpc'
  return os.platform() !== 'win32' ? `${os.tmpdir()}/${name}.sock` : `\\\\.\\pipe\\${name}`
}

module.exports = function getNetworkOptions (opts) {
  if (!opts.host && !opts.port) return getSocketPath()
  if (opts.host && !opts.port) return getSocketPath(opts.host)
  return { host: opts.host, port: opts.port }
}

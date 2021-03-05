const p = require('path')
const os = require('os')

const DEFAULT_STORAGE = p.join(os.homedir(), '.sonar')

module.exports = { storagePath }

function storagePath (storage) {
  return storage || process.env.SONAR_STORAGE || DEFAULT_STORAGE
}

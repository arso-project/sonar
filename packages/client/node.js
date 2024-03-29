// A re-export of the Sonar client, while loading the default access token from the file system if sonar-server is installed.

const { Workspace } = require('.')
const { storagePath } = require('@arsonar/common/storage')
const p = require('path')
const fs = require('fs')

class NodeWorkspace extends Workspace {
  constructor (opts = {}) {
    if (!opts.token) {
      // TODO: Put filenames in constants.js in sonar-common
      const path = p.join(storagePath(opts.storage), 'tokens.json')
      try {
        const json = fs.readFileSync(path)
        const data = JSON.parse(json)
        if (data && data.tokens && data.tokens.root) {
          opts.token = data.tokens.root
        }
      } catch (err) {}
    }
    super(opts)
  }
}
module.exports.Workspace = NodeWorkspace

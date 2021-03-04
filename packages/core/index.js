const Workspace = require('./lib/workspace')
const Collection = require('./lib/collection')
const LegacyWorkspace = require('./lib/compat')
module.exports = Object.assign(LegacyWorkspace, {
  Workspace,
  Collection,
  LegacyWorkspace
})

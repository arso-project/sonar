const Workspace = require('./lib/workspace')
const Collection = require('./lib/collection')
const CompatWorkspace = require('./lib/compat')
module.exports = Object.assign(CompatWorkspace, {
  Workspace,
  Collection,
  CollectionStore: CompatWorkspace
})

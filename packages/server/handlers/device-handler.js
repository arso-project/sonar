const AH = require('../lib/async-handler')

module.exports = function createDeviceHandler (workspace) {
  return {
    info: AH(async (req, res, next) => {
      const status = await workspace.status()
      return status
    }),

    createCollection: AH(async (req, res, next) => {
      const { name, key, alias } = req.body
      const opts = { alias, name }
      const collection = await workspace.createCollection(key || name, opts)
      return collection.status()
    })
  }
}

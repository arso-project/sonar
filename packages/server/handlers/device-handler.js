const AH = require('../lib/async-handler')

module.exports = function createDeviceHandler () {
  return {
    info: AH(async (req, res, next) => {
      const status = await req.workspace.status()
      return status
    }),

    createCollection: AH(async (req, res, next) => {
      const { name, key, alias } = req.body
      const opts = { alias, name }
      const collection = await req.workspace.createCollection(key || name, opts)
      return collection.status()
    })
  }
}

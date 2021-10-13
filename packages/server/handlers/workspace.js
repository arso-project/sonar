const AH = require('../lib/async-handler')

module.exports = function createWorkspaceHandler () {
  return {
    info: AH(async (req, res, next) => {
      const status = await req.workspace.status()
      return status
    })
  }
}

const { HttpError } = require('../lib/util')

module.exports = function createCollectionHandler (api) {
  return {
    createAccessCode (req, res, next) {
      api.auth.createAccessCode(req.query, (err, code) => {
        if (err) return next(err)
        res.send(code)
      })
    },
    login (req, res, next) {
      const { code } = req.query
      if (!code) return next(HttpError(403, 'Code is required'))
      api.auth.login(code, (err, token) => {
        if (err) return next(err)
        res.send({ token })
      })
    }
  }
}

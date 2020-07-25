const expressJwt = require('express-jwt')
const expressUnless = require('express-unless')

const { HttpError } = require('../lib/util')

module.exports = function createAuthHandler (api) {
  return {
    createAccessCode (req, res, next) {
      api.auth.createAccessCode(req.query, (err, code) => {
        if (err) return next(err)
        res.send(code)
      })
    },
    login (req, res, next) {
      // TODO: What to return if auth is disabled?
      if (api.config.disableAuthentication) {
        return res.send()
      }
      const { code } = req.query
      if (!code) return next(HttpError(403, 'Code is required'))
      api.auth.login(code, (err, token) => {
        if (err) return next(err)
        res.send({ token })
      })
    },

    createAuthMiddleware () {
      if (api.config.disableAuthentication) {
        return function (req, res, next) {
          next()
        }
      }

      function secretCallback (_req, _dtoken, cb) {
        api.auth.getSecret(cb)
      }

      const unlessOptions = { path: ['/login'], useOriginalUrl: false }

      const jwtMiddleware = expressJwt({
        secret: secretCallback,
        algorithms: ['HS256']
      })

      function checkAuthMiddleware (req, res, next) {
        if (!req.user.root) {
          res.status(403).send({ error: 'Not authorized' })
        }
        next()
      }
      checkAuthMiddleware.unless = expressUnless

      return [
        jwtMiddleware.unless(unlessOptions),
        checkAuthMiddleware.unless(unlessOptions)
      ]
    }
  }
}

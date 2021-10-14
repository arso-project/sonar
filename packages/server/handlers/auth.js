const expressJwt = require('express-jwt')
const expressUnless = require('express-unless')

const { HttpError } = require('../lib/util')

module.exports = function createAuthHandler (auth) {
  return {
    register (req, res, next) {
      auth.register(req.query, (err, code) => {
        if (err) return next(err)
        res.send(code)
      })
    },
    login (req, res, next) {
      // TODO: What to return if auth is disabled?
      const { code } = req.query
      if (!code) return next(HttpError(403, 'Code is required'))
      auth.login(code, (err, token) => {
        if (err) return next(err)
        res.send({ token })
      })
    },

    authMiddleware () {
      if (auth.disabled) {
        return function (req, res, next) {
          next()
        }
      }

      function secretCallback (_req, _dtoken, cb) {
        auth.getSecret(cb)
      }

      const unlessOptions = { path: ['/login'], useOriginalUrl: false }

      const jwtMiddleware = expressJwt({
        secret: secretCallback,
        algorithms: ['HS256'],
        getToken: getTokenFromRequest
      })

      function getTokenFromRequest (req) {
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
          return req.headers.authorization.split(' ')[1]
        } else if (req.query && req.query.token) {
          return req.query.token
        }
        return null
      }

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

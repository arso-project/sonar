const crypto = require('crypto')
const base32 = require('base32')
const p = require('path')
const Config = require('@arsonar/core/lib/config')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise')
const jwt = require('jsonwebtoken')
const { HttpError } = require('../lib/util')

module.exports = class Authenticator extends Nanoresource {
  constructor (storage, opts = {}) {
    super()
    this._tokens = new Map()
    this.disabled = !!opts.disableAuthentication
    this._store = new Config(p.join(storage, 'tokens.json'))
  }

  async _open () {
    return new Promise((resolve, reject) => {
      this._store.open(err => {
        if (err) return reject(err)
        if (!this._store.get().secret) {
          this._store.update(config => {
            config.secret = crypto.randomBytes(32).toString('hex')
            config.tokens = {
              root: generateRootToken(config.secret)
            }
            const rootAccessCode = generateRootAccessCode()
            config.accessCodes = {
              [rootAccessCode.code]: rootAccessCode.access
            }
            config.rootAccessCode = rootAccessCode.code
            return config
          }, err => {
            err ? reject(err) : resolve()
          })
        } else resolve()
      })
    })
  }

  getSecret (cb) {
    this.open((err) => {
      cb(err, this._secret)
    })
  }

  getRootToken () {
    if (!this.opened) return null
    return this._store.get().tokens.root
  }

  getRootAccessCode () {
    if (!this.opened) return null
    return this._store.get().rootAccessCode
  }

  get _secret () {
    return this._store.get().secret
  }

  async _close () {
    return new Promise((resolve, reject) => {
      this._store.close(err => err ? reject(err) : resolve())
    })
  }

  createAccessCode (opts, cb) {
    const code = accessCode()
    const access = { root: true }
    this._store.update(data => {
      data.accessCodes = data.accessCodes || {}
      data.accessCodes[code] = access
      return data
    }, err => {
      if (err) return cb(err)
      cb(null, code)
    })
  }

  login (accessCode, cb) {
    const access = this._store.getKey(['accessCodes', accessCode])
    if (!access) return cb(new HttpError(403, 'Invalid access code'))
    const opts = {
      expiresIn: 86400 * 30
    }
    const token = this.generateToken(access, opts)
    return cb(null, token)
  }

  generateToken (access, opts = {}) {
    const token = jwt.sign(access, this._secret, {
      expiresIn: 86400 * 30 // expires in 30 days
    })
    return token
  }
}

function generateRootToken (secret) {
  const access = { root: true }
  const token = jwt.sign(access, secret)
  return token
}
function generateRootAccessCode () {
  const code = accessCode()
  const access = { root: true }
  return { code, access }
}

function accessCode () {
  return base32.encode(crypto.randomBytes(16))
}

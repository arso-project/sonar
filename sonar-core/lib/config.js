const fs = require('fs')
const mutex = require('mutexify')

module.exports = class ConfigLoader {
  constructor (path) {
    this.path = path
    this.config = null
    this.lock = mutex()
  }

  load (cb) {
    const self = this

    if (this.config) return cb(null, this.config)

    fs.readFile(this.path, (err, buf) => {
      let config = {}
      if (err || !buf) return finish(config)
      try {
        config = JSON.parse(buf)
        finish(config)
      } catch (e) {
        finish(config)
      }
    })

    function finish (config) {
      Object.freeze(config)
      self.config = config
      cb(null, config)
    }
  }

  get () {
    if (!this.config) throw new Error('Config is not opened')
    return this.config
  }

  getKey (key) {
    const config = this.get()
    if (!Array.isArray(key)) key = key.split('.')
    return key.reduce((res, key) => {
      if (!(res && typeof res === 'object')) return
      return res[key]
    }, config)
  }

  close (cb) {
    this.lock(release => release(cb))
  }

  save (config, cb) {
    Object.freeze(config)
    this.lock(release => {
      this.config = config
      const json = JSON.stringify(this.config, null, 2)
      fs.writeFile(this.path, Buffer.from(json), (err) => {
        release(cb, err, { ...this.config })
      })
    })
  }

  update (fn, cb) {
    cb = cb || noop
    this.load((err, config) => {
      if (err) return cb(err)
      config = fn({ ...config })
      this.save(config, cb)
    })
  }
}

function noop () {}

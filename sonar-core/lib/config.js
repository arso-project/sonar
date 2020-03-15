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
      self.config = config
      cb(null, config)
    }
  }

  close (cb) {
    this.lock(release => release(cb))
  }

  save (config, cb) {
    this.lock(release => {
      this.config = config
      const json = JSON.stringify(this.config)
      fs.writeFile(this.path, Buffer.from(json), (err, res) => {
        release()
        cb(err, res)
      })
    })
  }

  update (fn, cb) {
    cb = cb || noop
    this.load((err, config) => {
      if (err) return cb(err)
      config = fn(config)
      this.save(config, cb)
    })
  }
}

function noop () {}

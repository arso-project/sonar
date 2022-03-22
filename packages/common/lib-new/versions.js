const Emitter = require('./emitter')

module.exports = class Versions extends Emitter {
  constructor (opts = {}) {
    super()
    this._versions = new Map()
    this._current = new Set()
  }

  current () {
    return Array.from([...this._current.values()])
  }

  all () {
    return Array.from([...this._versions.values()])
  }

  has (version) {
    if (this._versions.has(version.address)) return true
    return false
  }

  put (version) {
    this._versions.set(version.address, version)
    let isCurrent = true
    if (!version.links) version.links = []
    for (const current of this._current) {
      if (current.links.indexOf(version.link) !== -1) {
        isCurrent = false
      }
    }
    if (isCurrent) {
      for (const link of version.links) {
        if (this._versions.has(link)) {
          this._current.delete(this._versions.get(link))
        }
      }
      this._current.add(version)
    }
    console.log(
      'put version',
      version,
      this.all().map(v => v.value)
    )
  }
}

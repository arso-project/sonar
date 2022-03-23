const Emitter = require('./emitter')

module.exports = class Versions extends Emitter {
  constructor (opts = {}) {
    super()
    this._versions = new Map()
    this._current = new Set()
    this._outdated = new Set()
  }

  current () {
    return Array.from([...this._current.values()])
  }

  all () {
    return Array.from([...this._versions.values()])
  }

  latest () {
    return this.current().reduce((latest, current) => {
      if (!latest) return current
      if (current.timestamp > latest.timestamp) return current
      return latest
    })
  }

  has (version) {
    if (this._versions.has(version.address)) return true
    return false
  }

  put (version) {
    if (this._versions.has(version.address)) return
    this._versions.set(version.address, version)
    let isCurrent = true
    if (!version.links) version.links = []
    if (this._outdated.has(version.address)) {
      isCurrent = false
    } else {
      for (const current of this._current) {
        if (current.links.indexOf(version.address) !== -1) {
          isCurrent = false
        }
      }
    }
    for (const link of version.links) {
      this._outdated.add(link)
    }
    if (isCurrent) {
      for (const link of version.links) {
        if (this._versions.has(link)) {
          this._current.delete(this._versions.get(link))
        }
      }
      this._current.add(version)
    }
    this.emit()
  }
}

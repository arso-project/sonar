import { Emitter, EmitCb } from './emitter.js'
import { RecordVersion } from './record/version.js'
export default class Versions {
  private _versions: Map<string, RecordVersion>
  private _current: Set<RecordVersion>
  private _outdated: Set<string>
  private _emitter: Emitter<Versions>
  constructor () {
    this._emitter = new Emitter(this as Versions)
    this._versions = new Map()
    this._current = new Set()
    this._outdated = new Set()
  }

  get length () {
    return this._versions.size
  }

  get conflict () {
    return this._current.size > 1
  }

  emit () {
    this._emitter.emit()
  }

  subscribe (fn: EmitCb<Versions>) {
    return this._emitter.subscribe(fn)
  }

  current () {
    return Array.from([...this._current.values()])
  }

  all () {
    return Array.from([...this._versions.values()])
  }

  latest () {
    return this.current().reduce((latest, current) => {
      if (!latest) { return current }
      if (current.timestamp > latest.timestamp) { return current }
      return latest
    })
  }

  has (version: RecordVersion | string) {
    let versionAddress
    if (version instanceof RecordVersion) {
      versionAddress = version.address
    } else {
      versionAddress = version
    }
    if (this._versions.has(versionAddress)) { return true }
    return false
  }

  put (version: RecordVersion) {
    if (this._versions.has(version.address)) { return }
    this._versions.set(version.address, version)
    let isCurrent = true
    if (!version.links) { version.inner.links = [] }
    if (this._outdated.has(version.address)) {
      isCurrent = false
    } else {
      for (const current of this._current) {
        if (current.links?.indexOf(version.address) !== -1) {
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
          this._current.delete(this._versions.get(link)!)
        }
      }
      this._current.add(version)
    }
    this.emit()
  }
}

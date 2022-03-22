function bindSymbol (obj, symbol, value) {
  Object.defineProperty(obj, symbol, {
    enumerable: false,
    configurable: false,
    writable: false,
    value
  })
}

class MapSet {
  constructor () {
    this._map = new Map()
  }

  get (key) {
    if (this._map.has(key)) return this._map.get(key)
    return new Set()
  }

  add (key, value) {
    if (!this._map.has(key)) this._map.set(key, new Set())
    this.get(key).add(value)
  }

  has (key, value) {
    if (!this._map.has(key)) return false
    return this._map.get(key).has(value)
  }

  highest (key) {
    if (!this._map.has(key)) return null
    return Array.from(this._map.get(key))
      .sort()
      .pop()
  }
}

module.exports = { bindSymbol, MapSet }

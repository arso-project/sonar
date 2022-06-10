export function bindSymbol (obj: object, symbol: symbol, value: any) {
  Object.defineProperty(obj, symbol, {
    enumerable: false,
    configurable: false,
    writable: false,
    value
  })
}
export class MapSet<T> {
  _map: Map<string, Set<T>>
  constructor () {
    this._map = new Map()
  }

  get (key: string) {
    if (this._map.has(key)) { return this._map.get(key) }
    return new Set()
  }

  add (key: string, value: T) {
    if (!this._map.has(key)) { this._map.set(key, new Set()) }
    this.get(key)!.add(value)
  }

  has (key: string, value: T) {
    if (!this._map.has(key)) { return false }
    return this._map.get(key)!.has(value)
  }

  highest (key: string): T | undefined {
    if (!this._map.has(key)) { return undefined }
    return Array.from(this._map.get(key)!)
      .sort()
      .pop()
  }
}

import type { Schema } from './schema.js'
import { SC } from './symbols.js'

export class SchemaMember {
  [SC]!: Schema
  constructor (schema: Schema) {
    Object.defineProperty(this, SC, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: schema
    })
  }

  get schema () {
    return this[SC]
  }
}

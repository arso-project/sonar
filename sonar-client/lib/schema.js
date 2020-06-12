module.exports = class Schema {
  constructor () {
    this._schemas = {}
  }

  add (schemas) {
    this._schemas = { ...this.schemas, ...schemas }
  }

  getType (name) {
    return this._schemas[name]
  }

  listTypes () {
    return this._schemas
  }
}

module.exports = class Schema {
  constructor () {
    this._schemas = {}
  }

  add (schemas) {
    this._schemas = { ...this.schemas, ...schemas }
  }
}

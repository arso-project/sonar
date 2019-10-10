const Catalog = require('@arso-project/sonar-tantivy')
const { clock } = require('../log')

const { makeTantivySchema, getTextdumpSchema } = require('./schema')

module.exports = class IndexManager {
  constructor (storagePath, level, island) {
    this.catalog = new Catalog(storagePath)
    this.level = level
    this.island = island

    this.info = {}
    this.indexes = {}
    this._init = false
  }

  close () {
    this.catalog.close()
  }

  async ready () {
    if (this._init) return
    try {
      this.info = JSON.parse(await this.level.get('indexes'))
    } catch (e) {
      this.info = {}
    }

    for (const name of Object.keys(this.info)) {
      this.indexes[name] = await this.catalog.open(this._indexName(name))
    }

    await this.make('textdump')

    this._init = true
  }

  async make (name, schema) {
    if (this.indexes[name]) return
    let indexSchema
    if (name === 'textdump') indexSchema = getTextdumpSchema()
    else indexSchema = makeTantivySchema(schema)

    this.info[name] = indexSchema
    this.indexes[name] = await this.catalog.openOrCreate(this._indexName(name), indexSchema)

    await this.level.put('indexes', JSON.stringify(this.info))
  }

  getSchema (name) {
    if (!this.indexes[name]) throw new Error('Index does not exist: ' + name)
    return this.info[name]
  }

  _indexName (name) {
    return name.replace(/\//g, '.')
  }

  async get (name) {
    await this.ready()
    if (!this.indexes[name]) throw new Error('Index does not exist: ' + name)
    return this.indexes[name]
  }

  async getInfo () {
    await this.ready()
    return this.info
  }

  close () {
    this.catalog.close()
  }
}

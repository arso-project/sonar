const { makeTantivySchema, getTextdumpSchema } = require('./schema')

module.exports = class IndexManager {
  constructor ({ catalog, level, namespace }) {
    this.catalog = catalog
    this.level = level
    this.namespace = namespace

    this.info = {}
    this.indexes = {}
    this._init = false

    this.ready = async () => {
      if (!this._readyPromise) this._readyPromise = this._ready()
      return this._readyPromise
    }
  }

  async _ready () {
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

  async make (name, schema, opts = {}) {
    if (this.indexes[name]) return
    let indexSchema
    if (name === 'textdump') indexSchema = getTextdumpSchema()
    else indexSchema = makeTantivySchema(schema)

    if (!opts.persist) opts.persist = true

    this.info[name] = indexSchema
    this.indexes[name] = await this.catalog.openOrCreate(
      this._indexName(name),
      indexSchema,
      {
        ram: !opts.persist
      }
    )

    await this.level.put('indexes', JSON.stringify(this.info))
  }

  getSchema (name) {
    if (!this.indexes[name]) throw new Error('Index does not exist: ' + name)
    return this.info[name]
  }

  _indexName (name) {
    return this.namespace + '.' + name.replace(/\//g, '.')
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
}

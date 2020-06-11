const Client = require('./client')
const { DEFAULT_COLLECTION } = require('./constants')
const SearchQueryBuilder = require('./searchquerybuilder')

module.exports = class LegacyClient extends Client {
  constructor (opts) {
    super(opts)
    this._focus = null
    this._defaultCollection = opts.collection || DEFAULT_COLLECTION
  }

  focusCollection (name) {
    this._focus = this.openCollection(name)
  }

  async focusedCollection () {
    if (!this._focus && this._defaultCollection) this.focusCollection(this._defaultCollection)
    await this._focus
    return this._focus
  }

  // TODO: Remove.
  async getCurrentCollection () {
    return this.focusedCollection()
  }

  async info () {
    return this.fetch('/_info')
  }

  async getSchemas () {
    const collection = await this.focusedCollection()
    return collection.schema.listTypes()
  }

  async getSchema (name) {
    const collection = await this.focusedCollection()
    return collection.schema.getType(name)
  }

  async putSchema (name, schema) {
    schema.name = name
    const collection = await this.focusedCollection()
    return collection.putSchema(schema)
  }

  async putSource (key, opts) {
    const collection = await this.focusedCollection()
    return collection.putFeed(key, opts)
  }

  async get (req, opts) {
    const collection = await this.focusedCollection()
    return collection.get(req, opts)
  }

  async put (record) {
    const collection = await this.focusedCollection()
    return collection.put(record)
  }

  async del (record) {
    const collection = await this.focusedCollection()
    return collection.del(record)
  }

  async sync (view) {
    const collection = await this.focusedCollection()
    return collection.sync(view)
  }

  async query (name, args, opts) {
    const collection = await this.focusedCollection()
    return collection.query(name, args, opts)
  }

  async search (args, opts) {
    if (typeof args === 'string') {
      args = JSON.stringify(args)
    } else if (args instanceof SearchQueryBuilder) {
      args = args.getQuery()
    }
    const collection = await this.focusedCollection()
    return collection.query('search', args, opts)
  }

  // TODO: Port!
  // FS methods
  async getDrives () {
    const collection = await this.focusedCollection()
    return collection.fs.listDrives()
  }

  async readdir (path) {
    const collection = await this.focusedCollection()
    return collection.fs.readdir(path)
  }

  async writeFile (path, file, opts) {
    const collection = await this.focusedCollection()
    return collection.fs.writeFile(path, file, opts)
  }

  async readFile (path, opts) {
    const collection = await this.focusedCollection()
    return collection.fs.readFile(path, opts)
  }

  async statFile (path) {
    const collection = await this.focusedCollection()
    return collection.fs.stat(path)
  }

  async fileUrl (url) {
    const collection = await this.focusedCollection()
    return collection.fs.url(url)
  }

  // Subscriptions
  async pullSubscription (name, opts) {
    const collection = await this.focusedCollection()
    return collection.pullSubscription(name, opts)
  }

  async ackSubscription (name, cursor) {
    const collection = await this.focusedCollection()
    return collection.ackSubscription(name, cursor)
  }

  // Commands
  async initCommandStream (opts = {}) {
    return this.openCommandStream(opts)
  }

  async initCommandClient (opts = {}) {
    await this.openCommandStream(opts)
    return this.commands
  }

  async openCommandStream (opts = {}) {
    await this.commands.open()
    return this.commands
  }

  async callCommand (command, args) {
    const collection = await this.focusedCollection()
    const env = { collection: collection.name }
    return this.commands.call(command, args, env)
  }

  async callCommandStreaming (command, args) {
    const collection = await this.focusedCollection()
    const env = { collection: collection.name }
    return this.commands.callStreaming(command, args, env)
  }

  async createQueryStream (name, args, opts) {
    return this.callCommandStreaming('@collection query', [name, args, opts])
  }

  async createSubscriptionStream (name, opts = {}) {
    return this.callCommandStreaming('@collection subscribe', [name, opts])
  }
}

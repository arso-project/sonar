const Client = require('./client')
const { DEFAULT_COLLECTION } = require('./constants')

module.exports = class LegacyClient extends Client {
  constructor (opts) {
    super(opts)
    this._focus = null
    this.focusCollection(opts.collection || DEFAULT_COLLECTION)
    console.log('CONSTR', this)
  }

  focusCollection (name) {
    this._focus = this.openCollection(name)
  }

  async focusedCollection () {
    if (!this._focus) throw new Error('No collection focused')
    return this._focus
  }

  async getSchemas () {
    const collection = await this.focusedCollection()
    return collection.getSchemas()
  }

  async getSchema (name) {
    const collection = await this.focusedCollection()
    return collection.getSchema(name)
  }

  async putSchema (name, schema) {
    const collection = await this.focusedCollection()
    return collection.putSchema(name, schema)
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

  async search (query) {
    const collection = await this.focusedCollection()
    return collection.search(query)
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

  // TODO: backwards-compat only, remove.
  async initCommandStream (opts = {}) {
    return this.openCommandStream(opts)
  }

  async openCommandStream (opts = {}) {
    const collection = await this.focusedCollection()
    return collection.commands.open()
  }

  async callCommand (command, args) {
    const collection = await this.focusedCollection()
    return collection.commands.call(command, args)
  }

  async callCommandStreaming (command, args) {
    const collection = await this.focusedCollection()
    return collection.commands.callStreaming(command, args)
  }
}

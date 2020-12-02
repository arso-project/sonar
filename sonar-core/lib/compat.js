const p = require('path')
const os = require('os')
const Nanoresource = require('nanoresource/emitter')

const HyperFS = require('./fs')
const Workspace = require('./workspace')

const COMPAT_WRAP = Symbol('compat-wrap')

class CompatWorkspace extends Nanoresource {
  constructor (storagePath, opts) {
    super()
    opts.storagePath = storagePath || p.join(os.homedir(), '.sonar')
    this.workspace = new Workspace(opts)
  }

  get network () {
    return this.workspace.network
  }

  get corestore () {
    return this.workspace.corestore
  }

  _open (cb) {
    this.workspace.open().then(cb, cb)
  }

  _close (cb) {
    this.workspace.close().then(cb, cb)
  }

  ready (cb) {
    this.open(cb)
  }

  create (name, opts, cb) {
    let { key, alias } = opts
    const nameOrKey = key || name
    if (!alias && name) alias = name
    opts.key = undefined
    opts.alias = alias
    return this.get(nameOrKey, opts, cb)
  }

  get (keyOrName, opts = {}, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    const collection = this.workspace.Collection(keyOrName, opts)
    if (!collection[COMPAT_WRAP]) {
      wrapCollection(collection)
      if (opts.alias) this.workspace._collections.set(opts.alias, collection)
      collection[COMPAT_WRAP] = true
    }
    collection.open()
      .then(() => cb(null, collection))
      .catch(err => { console.error(err); cb(err) })
  }

  status (cb) {
    return this.workspace.status().then(res => cb(null, res), cb)
  }

  list (cb) {
    cb(new Error('Unimplemented'))
  }

  share (key) {
    const collection = this.workspace.Collection(key)
    collection.configure({ share: true }).catch(collection._onerror)
  }

  unshare (key) {
    const collection = this.workspace.Collection(key)
    collection.configure({ share: false }).catch(collection._onerror)
  }

  updateCollection (key, info, cb) {
    const collection = this.workspace.Collection(key)
    collection.configure(info).then(() => cb()).catch(cb)
  }

  getCollectionConfig (key) {
    const collection = this.workspace.Collection(key)
    return collection.getConfig()
  }

  replicate (...args) {
    return this.workspace.corestore.replicate(...args)
  }
}

function wrapCollection (collection) {
  const asyncFns = ['get', 'put', 'del', 'batch', 'putFeed', 'putType', 'query']
  // useHyperFS(collection)
  asyncToCallback(collection, asyncFns)
  collection.serializeSchema = function () {
    return collection.schema.toJSON()
  }
  collection.replicate = function (...args) {
    return collection._workspace.corestore.replicate(...args)
  }
  collection.pullSubscriptionStream = function (name, opts) {
    return collection.subscribe(name, opts).stream()
  }
}

function asyncToCallback (obj, asyncFns) {
  for (const name of asyncFns) {
    const orig = obj[name].bind(obj)
    obj[name] = function (...args) {
      const cb = args.pop()
      if (typeof cb === 'function') {
        orig(...args).then(result => cb(null, result)).catch(cb)
      } else {
        args.push(cb)
        return orig(...args)
      }
    }
  }
}

module.exports = CompatWorkspace
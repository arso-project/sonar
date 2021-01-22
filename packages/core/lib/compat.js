const p = require('path')
const os = require('os')
const Nanoresource = require('nanoresource/emitter')
const Workspace = require('./workspace')

const COMPAT_WRAP = Symbol('compat-wrap')

class LegacyWorkspace extends Nanoresource {
  constructor (storagePath, opts = {}) {
    super()
    opts.storagePath = storagePath || p.join(os.homedir(), '.sonar')
    this.workspace = new Workspace(opts)
  }

  get log () {
    return this.workspace.log
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
    if (typeof opts === 'function') { cb = opts; opts = {} }
    let { key, alias } = opts
    const nameOrKey = key || name
    if (!alias && name) alias = name
    opts.key = undefined
    opts.alias = alias
    opts.create = true
    opts = { ...opts }
    return this.get(nameOrKey, opts, cb)
  }

  get (keyOrName, opts = {}, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {} }
    this.workspace.openCollection(keyOrName, opts)
      .then(collection => {
        if (!collection[COMPAT_WRAP]) {
          wrapCollection(collection)
          if (opts.alias) this.workspace._collections.set(opts.alias, collection)
          collection[COMPAT_WRAP] = true
        }
        cb(null, collection)
      })
      .catch(err => cb(err))
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
  collection.createSubscription = function (name, opts) {
    return collection.subscribe(name, opts)
  }
  collection.pullSubscriptionStream = function (name, opts) {
    return collection.subscribe(name, opts).stream()
  }
  collection.pullSubscription = function (name, opts, cb) {
    collection.subscribe(name, opts).pull()
      .then(res => cb(null, res), cb)
  }
  collection.ackSubscription = function (name, cursor, cb) {
    collection.subscribe(name).ack(cursor)
      .then(res => cb(null, res), cb)
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

module.exports = LegacyWorkspace

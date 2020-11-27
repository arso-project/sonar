const p = require('path')
const os = require('os')
const Nanoresource = require('nanoresource/emitter')

const HyperFS = require('./fs')
const Workspace = require('./workspace')

module.exports = class CompatWorkspace extends Nanoresource {
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
    wrapCollection(collection)
    if (opts.alias) this.workspace._collections.set(opts.alias, collection)
    collection.open()
      .then(() => cb(null, collection))
      .catch(err => { console.error(err); cb(err) })
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
  useHyperFS(collection)
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

function useHyperFS (collection) {
  const fs = new HyperFS({
    corestore: collection._workspace.corestore,
    db: collection._leveldb('fs'),
    oninit,
    resolveAlias
  })
  collection.fs = fs
  collection.drive = (...args) => collection.fs.get(...args)

  function oninit (localDriveKey, cb) {
    collection.putFeed(localDriveKey, {
      type: 'hyperdrive',
      alias: collection._opts.alias
    }, cb)
  }

  function resolveAlias (alias, cb) {
    collection.query('records', { type: 'sonar/feed' }, (err, records) => {
      if (err) return cb(err)
      const aliases = records
        .map(r => r.value)
        .filter(v => v.type === 'hyperdrive')
        .filter(v => v.alias === alias)

      if (aliases.length > 1) {
        // TODO: Support named aliases (like foo-1, foo-2)
        return cb(new Error('alias is ambigous, use keys'))
      }
      if (!aliases.length) {
        return cb(new Error('alias not found'))
      }

      cb(null, aliases[0].key)
    })
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

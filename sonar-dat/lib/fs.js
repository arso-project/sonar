const hyperdrive = require('hyperdrive')
const { EventEmitter } = require('events')
const collect = require('stream-collector')
const sub = require('subleveldown')

const DRIVES = 'd!'
const LOCALW = 'w!'

module.exports = class SonarFs extends EventEmitter {
  constructor (opts) {
    super()
    this.corestore = opts.corestore
    this.db = opts.db

    this.handlers = {
      oninit: opts.oninit,
      resolveAlias: opts.resolveAlias
    }
    this.drives = {}
    this.aliases = {}
  }

  ready (cb) {
    this._localwriter((err, drive) => {
      if (err) return cb(err)
      this.localwriter = drive
      this.aliases.me = this.localwriter.key.toString('hex')
      this.localkey = drive.key
      cb()
    })
  }

  add (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    this.db.put(DRIVES + key, '')
    this.emit('drive', key)
  }

  _localwriter (cb) {
    this.db.get(LOCALW, (err, key) => {
      if (err && !err.notFound) return cb(err)
      if (key) return this.get(key, cb)
      else {
        const drive = this.create()
        const key = drive.key.toString('hex')
        this.add(drive)
        this.db.put(LOCALW, key, () => cb(null, drive))
        if (this.handlers.oninit) this.handlers.oninit(key)
      }
    })
  }

  list (cb) {
    collect(this.db.createReadStream(prefix(DRIVES), (err, results) => {
      if (err) return cb(err)
      const keys = results.map(r => r.key)
      cb(keys)
    }))
  }

  get (keyOrAlias, cb) {
    this.resolveAlias(keyOrAlias, (err, key) => {
      if (err) return cb(err)
      if (this.drives[key]) return cb(null, this.drives[key])

      const drive = hyperdrive(this.corestore, key)
      drive.ready((err) => {
        if (err) return cb(err)
        this.drives[key] = drive
        cb(null, drive)
      })
    })
  }

  resolveAlias (alias, cb) {
    if (Buffer.isBuffer(alias)) return cb(null, alias.toString('hex'))
    if (validKey(alias)) return cb(null, alias)
    if (!this.handlers.resolveAlias) return cb(new Error('Cannot resolve alias'))
    this.handlers.resolveAlias(alias, cb)
  }

  create () {
    const feed = this.corestore.get()
    const key = feed.key.toString('hex')
    const drive = hyperdrive(this.corestore, feed.key)
    this.drives[key] = drive
    this.add(key)
    return drive
  }
}

function validKey (str) {
  return str.match(/^[a-f0-9]{64}$/)
}

function prefix (key) {
  return {
    gte: key,
    lte: key + '\uffff'
  }
}

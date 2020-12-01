const hyperdrive = require('hyperdrive')
const datEncoding = require('dat-encoding')
const Nanoresource = require('nanoresource/emitter')
const collect = require('stream-collector')

const DRIVES = 'd!'
const LOCALW = 'w!'

module.exports = class SonarFs extends Nanoresource {
  constructor (opts) {
    super()
    this.corestore = opts.corestore
    // this.db is a leveldb.
    this.db = opts.db

    this.handlers = {
      oninit: opts.oninit,
      resolveAlias: opts.resolveAlias
    }
    this.drives = {}
    this.aliases = {}
    this.ready = this.open.bind(this)
  }

  _close (cb) {
    let pending = Object.values(this.drives).length
    if (!pending) return cb()
    for (const drive of Object.values(this.drives)) {
      drive.close(done)
    }
    function done () {
      if (--pending === 0) cb()
    }
  }

  _open (cb) {
    this._openLocalwriter((err, drive) => {
      if (err) return cb(err)
      this.localwriter = drive
      this.aliases.me = this.localwriter.key.toString('hex')
      this.localkey = drive.key
      cb()
    })
  }

  status (cb) {
    if (!this.opened) this.open(() => this.status(cb))
    cb = once(cb)
    const stats = {}
    let pending = Object.values(this.drives).length
    for (const drive of Object.values(this.drives)) {
      drive.ready(() => {
        const key = drive.key.toString('hex')
        driveStats(drive, (err, dstats) => {
          if (err) return cb(err)
          stats[key] = dstats
          if (--pending === 0) cb(null, stats)
        })
      })
    }

    function driveStats (drive, cb) {
      let pending = 2
      const stats = {
        discoveryKey: drive.discoveryKey.toString('hex'),
        version: drive.version,
        writable: drive.writable,
        contentWritable: drive.contentWritable,
        metadata: feedStats(drive.db.feed)
      }

      drive.getContent((err, feed) => {
        if (err) return cb(err)
        stats.content = feedStats(feed)
        if (--pending === 0) cb(null, stats)
      })

      drive.getAllMounts((err, mounts) => {
        if (err) return cb(err)
        stats.mounts = Object.entries(mounts).reduce((agg, [key, feeds]) => {
          agg[key] = {
            metadata: feedStats(feeds.metadata),
            content: feedStats(feeds.content)
          }
          return agg
        }, {})
        if (--pending === 0) cb(null, stats)
      })
    }

    function feedStats (feed) {
      return {
        key: feed.key.toString('hex'),
        writable: feed.writable,
        length: feed.length,
        byteLength: feed.byteLength,
        downloadedBlocks: feed.downloaded(0, feed.length),
        stats: feed.stats
      }
    }
  }

  add (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    this.db.put(DRIVES + key, '')
    this.emit('drive', key)
  }

  // Open the writable drive, create if not exists.
  _openLocalwriter (cb) {
    // Get the local writer key from the leveldb.
    this.db.get(LOCALW, (err, key) => {
      if (err && !err.notFound) return cb(err)
      if (key) return this._openDrive(key, cb)
      else this._createLocalwriter(cb)
    })
  }

  _createLocalwriter (cb) {
    this._createDrive((err, drive) => {
      if (err) return cb(err)
      const hkey = drive.key.toString('hex')
      this.add(drive)
      this.db.put(LOCALW, hkey, err => {
        if (err) return cb(err)
        if (this.handlers.oninit) {
          this.handlers.oninit(hkey, err => {
            cb(err, drive)
          })
        } else {
          cb(null, drive)
        }
      })
    })
  }

  list (cb) {
    if (!this.opened) this.open(() => this.status(cb))
    collect(this.db.createReadStream(prefix(DRIVES), (err, results) => {
      if (err) return cb(err)
      const keys = results.map(r => r.key)
      cb(keys)
    }))
  }

  _createDrive (cb) {
    const feed = this.corestore.get()
    feed.ready(() => {
      const key = feed.key.toString('hex')
      this._openDrive(key, cb)
    })
  }

  _openDrive (key, cb) {
    key = datEncoding.decode(key)
    const hkey = datEncoding.encode(key)
    const drive = hyperdrive(this.corestore, key)
    this.drives[hkey] = drive
    drive.ready((err) => {
      if (err) return cb(err)
      cb(null, drive)
    })
  }

  // Get a drive by key or alias.
  get (keyOrAlias, cb) {
    if (!this.opened) return this.open(() => this.get(keyOrAlias, cb))
    this._resolveAlias(keyOrAlias, (err, key) => {
      if (err) return cb(err)
      this._openDrive(key, cb)
    })
  }

  _resolveAlias (alias, cb) {
    if (!this.opened) this.open(() => this.resolveAlias(cb))
    if (Buffer.isBuffer(alias)) return cb(null, alias.toString('hex'))
    if (validKey(alias)) return cb(null, alias)
    if (!this.handlers.resolveAlias) return cb(new Error('Cannot resolve alias'))
    this.handlers.resolveAlias(alias, (err, key) => {
      if (err || !key) return cb(err || new Error('invalid alias: ' + alias))
      cb(null, key)
    })
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

function once (fn) {
  let called = false
  return (...args) => {
    if (called) return
    called = true
    fn(...args)
  }
}

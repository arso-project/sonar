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

  close (cb) {
    let pending = Object.values(this.drives).length
    if (!pending) return cb()
    for (const drive of Object.values(this.drives)) {
      drive.close(done)
    }
    function done () {
      if (--pending === 0) cb()
    }
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

  status (cb) {
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
    this.handlers.resolveAlias(alias, (err, key) => {
      if (err || !key) return cb(err || new Error('invalid alias: ' + alias))
      cb(null, key)
    })
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

function once (fn) {
  let called = false
  return (...args) => {
    if (called) return
    called = true
    fn(...args)
  }
}

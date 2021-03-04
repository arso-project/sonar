const hyperdrive = require('hyperdrive')
const datEncoding = require('dat-encoding')
const Nanoresource = require('nanoresource/emitter')
const collect = require('stream-collector')

const DRIVES = 'd!'
const LOCALW = 'w!'

function registerHyperdrive (workspace) {
  workspace.on('collection-opening', onCollectionOpen)
}

function onCollectionOpen (collection, awaitOpen) {
  const fs = new SonarHyperdrive({
    corestore: collection._workspace.corestore,
    db: collection._leveldb('fs'),
    oninit,
    resolveAlias
  })

  // TODO: Adding methods or objects to the collection object
  // like this is not super nice
  collection.fs = fs
  collection.drive = (...args) => collection.fs.get(...args)
  collection.once('close', () => fs.close())

  fs.on('drive-open', drive => {
    collection._workspace.network.configure(drive.discoveryKey, { announce: true, lookup: true })
  })

  // let the opening wait until fs is opened
  const callback = awaitOpen()
  fs.open(err => callback(err))

  function oninit (localDriveKey, cb) {
    const config = collection.getConfig()
    collection.putFeed(localDriveKey, {
      type: 'hyperdrive',
      alias: collection._opts.alias || collection.name
    }).then(res => cb(null, res), cb)
  }

  async function resolveAlias (alias) {
    const records = await collection.query('records', { type: 'sonar/feed' })
    const aliases = records
      .map(r => r.value)
      .filter(v => v.type === 'hyperdrive')
      .filter(v => v.alias === alias)

    if (aliases.length > 1) {
      // TODO: Support named aliases (like foo-1, foo-2)
      throw new Error('alias is ambigous, use keys')
    }
    if (!aliases.length) {
      throw new Error('alias not found')
    }

    return aliases[0].key
  }
}

class SonarHyperdrive extends Nanoresource {
  constructor (opts) {
    super()
    this.corestore = opts.corestore.namespace('sonar-fs')
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
    const self = this
    key = datEncoding.decode(key)
    const hkey = datEncoding.encode(key)
    this.corestore.ready((err) => {
      if (err) return cb(err)
      const drive = hyperdrive(this.corestore, key)
      this.drives[hkey] = drive
      drive.ready((err) => {
        if (err) return cb(err)
        self.emit('drive-open', drive)
        cb(null, drive)
      })
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
    if (!this.opened) return this.open(() => this._resolveAlias(alias, cb))
    if (Buffer.isBuffer(alias)) return cb(null, alias.toString('hex'))
    if (validKey(alias)) return cb(null, alias)
    if (alias === '~me') return cb(null, this.localwriter.key.toString('hex'))
    if (!this.handlers.resolveAlias) return cb(new Error('Cannot resolve alias'))
    this.handlers.resolveAlias(alias)
      .catch(cb)
      .then(key => {
        if (!key) return cb(new Error('invalid alias: ' + alias))
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

module.exports = SonarHyperdrive
module.exports.registerHyperdrive = registerHyperdrive

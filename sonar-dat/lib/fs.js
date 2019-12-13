const hyperdrive = require('hyperdrive')
const { EventEmitter } = require('events')
const collect = require('stream-collector')
const sub = require('subleveldown')

const DRIVES = 'd!'
const LOCALW = 'w!'

module.exports = class SonarFs extends EventEmitter {
  constructor ({ corestore, db }) {
    super()
    this.corestore = corestore
    this.db = db
    this.drives = {}
  }

  ready (cb) {
    this._localwriter((err, drive) => {
      if (err) return cb(err)
      this.localwriter = drive
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
      if (key) return cb(null, this.get(key))
      else {
        const drive = this.create()
        const key = drive.key.toString('hex')
        this.add(drive)
        this.db.put(LOCALW, key, () => cb(null, drive))
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

  get (key) {
    if (Buffer.isBuffer(key)) key = key.toString('hex')
    if (this.drives[key]) return this.drives[key]
    const drive = hyperdrive(this.corestore, key)
    this.drives[key] = drive
    return drive
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

function prefix (key) {
  return {
    gte: key,
    lte: key + '\uffff'
  }
}

const { SCHEMA_RESOURCE, HYPERDRIVE_SCHEME, METADATA_ID } = require('./constants')

module.exports = class Resources {
  constructor (collection) {
    this.collection = collection
  }

  async _localDriveKey () {
    if (this._localDrive) return this._localDrive
    const drives = await this.collection.fs.listDrives()
    const writableDrives = drives.filter(f => f.writable)
    if (!writableDrives.length) throw new Error('No writable drive')
    this._localDrive = writableDrives[0].key
    return this._localDrive
  }

  async writeFile (record, file, opts = {}) {
    const url = getContentUrl(record)
    if (!url) throw new Error('record has no file url')
    if (!opts.metadata) opts.metadata = {}
    opts.metadata[METADATA_ID] = record.id
    return this.collection.fs.writeFile(url, file, opts)
  }

  async readFile (record, opts = {}) {
    const url = getContentUrl(record)
    if (!url) throw new Error('record has no file url')
    return this.collection.fs.readFile(url, opts)
  }

  async create (value, opts = {}) {
    const { filename, prefix } = value
    if (!filename) throw new Error('Filename is required')
    if (filename.indexOf('/') !== -1) throw new Error('Invalid filename')
    if (opts.scoped) throw new Error('Scoped option is not supported')

    let filepath
    if (prefix) filepath = [prefix, filename].join('/')
    else filepath = filename

    const drivekey = await this._localDriveKey()
    const contentUrl = createHyperdriveUrl(drivekey, filepath)

    let id
    // TODO: Check for resources also/instead?
    // This checks only the local drive.
    try {
      var existing = await this.collection.fs.statFile(contentUrl)
    } catch (err) {}

    if (existing) {
      id = existing.metadata[METADATA_ID]
      if (!id) {
        if (!opts.force) throw new Error('file exists and has no resource attached. set fore to overwrite.')
      } else {
        // TODO: Preserve fields from an old resource?
        // const oldResource = await this.get({ id: existing.metadata[METADATA_ID] })
        if (!opts.update) throw new Error(`file exists, with resource ${id}. set update to overwrite.`)
      }
    }

    id = id || opts.id

    const res = await this.collection.put({
      type: SCHEMA_RESOURCE,
      id,
      value: {
        ...value,
        contentUrl,
        filename
      }
    })
    // TODO: This should get by keyseq. Or put should just return the
    // putted record.
    const records = await this.collection.get({
      id: res.id,
      type: SCHEMA_RESOURCE
    }, { waitForSync: true })
    if (!records.length) {
      throw new Error('error loading created resource')
    }
    return records[0]
  }

  resolveFileURL (record) {
    const url = getContentUrl(record)
    return this.collection.fs.resolveURL(url)
  }
}

function createHyperdriveUrl (key, path) {
  return `${HYPERDRIVE_SCHEME}//${key}/${path}`
}

function getContentUrl (record) {
  if (!record.hasType(SCHEMA_RESOURCE)) return null
  if (!record.value.contentUrl) return null
  return record.value.contentUrl
}

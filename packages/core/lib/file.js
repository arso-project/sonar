const mime = require('mime-types')
const { Readable } = require('streamx')
const { uuid } = require('./util')
const parseRange = require('range-parser')
const Hyperblobs = require('hyperblobs')

class EmptyStream extends Readable {
  constructor (...args) {
    super(...args)
    this.push(null)
  }
}

module.exports = class Files {
  constructor (collection) {
    this.collection = collection
    this.localBlobs = null
    this.remoteBlobs = new Map()
  }

  async _getLocalBlobs () {
    if (this.localBlobs) return this.localBlobs
    if (this._initLocalBlobs) return await this._initLocalBlobs
    this._initLocalBlobs = (async () => {
      const name = this.collection.id + ':blobs:v1'
      const blobs = await this._getBlobs(name)
      this.localBlobs = blobs
      return blobs
    })()
    return await this._initLocalBlobs
  }

  async _getBlobs (keyOrName) {
    const core = await this.collection._initFeed(
      keyOrName,
      { type: 'sonar.blobs' },
      { index: false }
    )
    const blobs = new Hyperblobs(core)
    return blobs
  }

  async _writeFile (id, stream) {
    const blobs = await this._getLocalBlobs()
    // The following pipes the request into a hyperblobs write stream.
    // It waits for the first chunk to arrive, and errors if the stream
    // closes before any data arrived.
    let writeStream
    await new Promise((resolve, reject) => {
      let didWrite = false
      stream.once('data', chunk => {
        didWrite = true
        writeStream = blobs.createWriteStream()
        writeStream.write(chunk)
        stream
          .pipe(writeStream)
          .once('error', reject)
          .once('finish', resolve)
      })
      stream.once('end', () => {
        if (!didWrite) reject(new Error('Stream was empty'))
      })
    })

    const blobID = writeStream.id
    blobID.key = blobs.feed.key.toString('hex')
    const contentUrl = encodeBlobID(blobID)
    return { size: blobID.byteLength, contentUrl }
  }

  async createFile (stream, metadata = {}) {
    if (metadata.filename && !metadata.encodingFormat) {
      metadata.encodingFormat = mime.lookup(metadata.filename)
    }
    const id = uuid()
    const { size, contentUrl } = await this._writeFile(id, stream)
    const record = {
      type: 'sonar/file',
      id,
      value: {
        ...metadata,
        contentSize: size,
        contentUrl
      }
    }
    return await this.collection.put(record)
  }

  async updateFile (id, stream, metadata = {}) {
    const records = await this.collection.get({ id, type: 'sonar/file' })
    if (!records.length) throw new NotFoundError()
    // TODO: Handle conflicts.
    const record = records[0]
    const { size, contentUrl } = await this._writeFile(id, stream)
    const nextRecord = {
      type: 'sonar/file',
      id,
      value: {
        ...record.value,
        ...metadata,
        contentSize: size,
        contentUrl
      }
    }
    return await this.collection.put(nextRecord)
  }

  async readFile (id) {
    const { blobs, blobID } = await this.resolveFile(id)
    const readStream = blobs.createReadStream(blobID)
    return readStream
  }

  async getRecord (id) {
    const record = await this.collection.get(
      { id, type: 'sonar/file' },
      { single: true }
    )
    return record
  }

  async readFileWithHeaders (id, { method = 'GET', headers = {} }) {
    const { blobs, blobID, record } = await this.resolveFile(id)
    const meta = record.value

    const range =
      headers.range && parseRange(meta.contentSize, headers.range)[0]
    const responseHeaders = {}
    responseHeaders['Accept-Ranges'] = 'bytes'
    responseHeaders['Content-Type'] =
      meta.contentEncoding || 'application/octet-stream'
    let statusCode = 200
    if (range) {
      statusCode = 206
      responseHeaders['Content-Range'] =
        'bytes ' + range.start + '-' + range.end + '/' + meta.contentSize
      responseHeaders['Content-Length'] = range.end - range.start + 1
    } else {
      responseHeaders['Content-Length'] = meta.contentSize
    }

    if (method === 'HEAD') return new EmptyStream()
    const readStream = blobs.createReadStream(blobID, range)
    return { stream: readStream, headers: responseHeaders, statusCode }
  }

  async resolveFile (id) {
    const record = await this.getRecord(id)
    if (!record) throw new NotFoundError()
    const blobID = parseBlobID(record.value.contentUrl)
    const blobs = await this._getBlobs(blobID.key)
    return { record, blobs, blobID }
  }
}

class NotFoundError extends Error {
  constructor (message) {
    super(message || 'Not found')
    this.reason = 'notfound'
  }
}

function encodeBlobID (blobID) {
  const { key, byteOffset, blockOffset, blockLength, byteLength } = blobID
  const path = `${blockOffset}+${blockLength}/${byteOffset}+${byteLength}`
  return `hyperblob://${key}/${path}`
}

function parseBlobID (url) {
  if (!url.startsWith('hyperblob://')) throw new Error('Invalid URL')
  const [key, block, byte] = url.substring(12).split('/')
  const [blockOffset, blockLength] = block.split('+').map(Number)
  const [byteOffset, byteLength] = byte.split('+').map(Number)
  return { key, blockOffset, blockLength, byteOffset, byteLength }
}

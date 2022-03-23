const mime = require('mime-types')
const { pipeline, Readable, Transform } = require('streamx')
const { uuid } = require('./util')
const parseUrl = require('parse-dat-url')
const parseRange = require('range-parser')

class EmptyStream extends Readable {
  constructor (...args) {
    super(...args)
    this.push(null)
  }
}

module.exports = class Files {
  constructor (collection) {
    this.collection = collection
  }

  async _writeFile (id, stream) {
    const drive = await this.collection.drive('~me')
    // The following pipes the request into a hyperdrive write stream.
    // It waits for the first chunk to arrive, and errors if the stream
    // closes before any data arrived.
    await new Promise((resolve, reject) => {
      let didWrite = false
      stream.once('data', chunk => {
        didWrite = true
        const writeStream = drive.createWriteStream(id)
        writeStream.write(chunk)
        stream.pipe(writeStream).once('error', reject).once('finish', resolve)
      })
      stream.once('end', () => {
        if (!didWrite) reject(new Error('Stream was empty'))
      })
    })

    const stat = await new Promise((resolve, reject) => {
      drive.stat(id, { wait: true }, (err, stat) =>
        err ? reject(err) : resolve(stat)
      )
    })
    // TODO: Include drive version in url.
    const contentUrl = 'hyper://' + drive.key.toString('hex') + '/' + id
    return { size: stat.size, contentUrl }
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
    const record = await this.getRecord(id)
    if (!record) throw new NotFoundError()
    const { host, path } = parseUrl(record.contentUrl)
    const drive = await this.collection.drive(host)
    const readStream = drive.createReadStream(path)
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
    const { hyperdrive, path, record } = await this.resolveFile(id)
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
    const readStream = hyperdrive.createReadStream(path, range)
    return { stream: readStream, headers: responseHeaders, statusCode }
  }

  async resolveFile (id) {
    const record = await this.getRecord(id)
    if (!record) throw new NotFoundError()
    const url = parseUrl(record.value.contentUrl)
    const { host, path } = url
    const hyperdrive = await this.collection.drive(host)
    return { hyperdrive, path, record }
  }
}

class NotFoundError extends Error {
  constructor (message) {
    super(message || 'Not found')
    this.reason = 'notfound'
  }
}

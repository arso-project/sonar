const { HYPERDRIVE_SCHEME } = require('./constants')
const parseUrl = require('parse-dat-url')

class Fs {
  /**
   * File system for a collection.
   *
   * @constructor
   * @param {Collection} collection - Collection
   */
  constructor (collection) {
    this.endpoint = collection.endpoint + '/fs'
    this.collection = collection
  }

  resolveURL (path) {
    // Support hyper:// URLs.
    if (path.startsWith(HYPERDRIVE_SCHEME)) {
      const url = parseUrl(path)
      path = url.host + url.path
    // Support no other absolute URLs for now.
    } else if (path.indexOf('://') !== -1) {
      throw new Error('Invalid path: Only hyper:// URLs or paths are supported')
    }
    // Assume it's a path to a file in the island fs, will fail if not found.
    if (!path.startsWith('/')) path = '/' + path
    return this.endpoint + path
  }

  async fetch (path, opts = {}) {
    path = this.resolveURL(path)
    return this.collection.fetch(path, opts)
  }

  /**
   * List the drives that are part of this collection.
   *
   * @async
   * @return {Promise<Array<object>>} Array of objects with `{ alias, key, writable }`
   */
  async listDrives () {
    // TODO: Move route under /fs somehow. Maybe HEAD on /?
    return this.collection.fetch('/fs-info')
  }

  /**
   * Get the contents of a directory.
   *
   * @async
   * @param {string} path - A hyper:// URL or a relative path within the collection's file system.
   * @param {object} [opts} - Options
   * @param {string} [opts.includeStats=true] - Include metadata for each file
   * @throws Will throw if the path is not found or is not a directory.
   * @return {Promise<Array<object>>} An array of objects with file metadata.
   */
  async readdir (path, opts = {}) {
    const self = this
    path = path || '/'
    if (path === '/') {
      const drives = await this.listDrives()
      return drives.map(drive => ({
        name: drive.alias,
        link: '',
        resource: null,
        length: null,
        directory: true
      }))
    }
    if (path.length > 2 && path.charAt(0) === '/') path = path.substring(1)
    const alias = path.split('/')[0]

    let files = await this.fetch(path)

    if (files && files.length) {
      files = files.map(file => {
        file.link = makeLink(file)
        file.resource = getResource(file)
        return file
      })
    }
    return files

    function makeLink (file) {
      return `${self.endpoint}/${self.collection.name}/fs/${alias}/${file.path}`
    }

    function getResource (file) {
      if (!file || !file.metadata || !file.metadata['sonar.id']) return null
      return file.metadata['sonar.id']
    }
  }

  /**
   * Write a file
   *
   * @async
   * @param {string} path - A hyper:// URL or a relative path within the collection's file system.
   * @param {Stream|Buffer} file - File content to write.
   * @param {object} [opts] - Options. TODO: document.
   * @throws Will throw if the path cannot be written to.
   * @return {Promise}
   */
  async writeFile (path, file, opts = {}) {
    const requestType = opts.requestType || 'buffer'
    const params = {}
    if (opts.metadata) params.metadata = JSON.stringify(opts.metadata)

    return this.fetch(path, {
      method: 'PUT',
      body: file,
      params,
      responseType: 'text',
      requestType,
      // binary: true,
      onUploadProgress: opts.onUploadProgress
    })
  }

  /**
   * Read a file into a buffer.
   *
   * @async
   * @param {string} path - A hyper:// URL or a relative path within the collection's file system.
   * @param {object} [opts] - Options. TODO: document.
   * @throws Will throw if the path is not found.
   * @return {Promise<ArrayBuffer|Buffer>} The file content. A Buffer object in Node.js, a ArrayBuffer object in the browser.
   */
  async readFile (path, opts = {}) {
    opts.responseType = opts.responseType || 'buffer'
    opts.requestType = opts.requestType || 'buffer'
    return this.fetch(path, opts)
  }

  /**
   * Get a read stream for a file.
   *
   * @async
   * @param {string} path - A hyper:// URL or a relative path within the collection's file system.
   * @param {object} [opts] - Options. TODO: document.
   * @throws Will throw if the path is not found.
   * @return {Promise<ReadableStream|Readable>} A `stream.Readable` in Node.js, a `ReadableStream`in the browser.
   */
  async createReadStream (path, opts = {}) {
    opts.responseType = 'stream'
    return this.readFile(path, opts)
  }

  /**
   * Get metadata about a file.
   *
   * @async
   * @param {string} path - A hyper:// URL or a relative path within the collection's file system.
   * @throws Will throw if the path is not found.
   * @return {Promise<object>} A plain object with the stat info.
   */
  async statFile (path) {
    return this.fetch(path)
  }
}

module.exports = Fs

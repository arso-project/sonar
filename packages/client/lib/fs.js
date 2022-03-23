const { HYPERDRIVE_SCHEME } = require('./constants')
const parseUrl = require('parse-dat-url')

/**
 * File system for a collection.
 */
class Fs {
  /**
   * File system for a collection.
   *
   * @constructor
   * @param {Collection} collection - Collection
   */
  constructor (collection) {
    this.endpoint = collection.endpoint + '/file'
    this.collection = collection
  }

  async fetch (path, opts = {}) {
    opts.endpoint = this.endpoint
    return this.collection.fetch(path, opts)
  }

  /**
   * List the drives that are part of this collection.
   *
   * @async
   * @return {Promise<Array<object>>} Array of drive objects with keys `{ alias, key, writable }`
   */
  async listDrives () {
    // TODO: Move route under /fs somehow. Maybe HEAD on /?
    return this.collection.fetch('/fs-info')
  }

  /**
   * Create a new file
   * @param {Stream|Buffer} stream - File content as stream or buffer
   * @param {object} [metadata] - File record metadata (see file record schema)
   * @param {object} [opts] - Options.
   *  - onUploadProgress: Callback to invoke with upload progress information
   * @returns {Record} - The created file record
   */
  async createFile (stream, metadata, opts = {}) {
    const requestType = 'stream'
    const params = {}
    if (metadata) params.metadata = JSON.stringify(metadata)
    return await this.fetch('/', {
      method: 'POST',
      body: stream,
      params,
      requestType,
      onUploadProgress: opts.onUploadProgress
    })
  }

  /**
   * Update a file
   * @param {string} id - The file record id
   * @param {Stream|Buffer} stream - File content as stream or buffer
   * @param {object} [metadata] - File record metadata (see file record schema)
   * @param {object} [opts] - Options.
   *  - onUploadProgress: Callback to invoke with upload progress information
   * @returns {Record} - The created file record
   */
  async updateFile (id, stream, metadata, opts = {}) {
    const requestType = 'stream'
    const params = {}
    if (metadata) params.metadata = JSON.stringify(metadata)
    return await this.fetch('/' + id, {
      method: 'PUT',
      body: stream,
      params,
      requestType,
      onUploadProgress: opts.onUploadProgress
    })
  }

  /**
   * Read a file into a buffer.
   *
   * @async
   * @param {string} id - A file ID
   * @param {object} [opts] - Options. TODO: document.
   * @throws Will throw if the path is not found.
   * @return {Promise<ArrayBuffer|Buffer>} The file content. A Buffer object in Node.js, a ArrayBuffer object in the browser.
   */
  async readFile (id, opts = {}) {
    opts.responseType = opts.responseType || 'stream'
    return this.fetch('/' + id, opts)
  }

  /**
   * Get the metadata for a file
   *
   * @async
   * @param {string} id - A file ID
   * @throws Will throw if the path is not found.
   * @return {Promise<object>} The file record value (metadata)
   */
  async getFileMetadata (id, opts = {}) {
    return this.fetch(`/${id}?meta=1`, opts)
  }
}

module.exports = Fs

/**
 * File system for a collection.
 */
class Files {
  /**
   * File system for a collection.
   *
   * @constructor
   * @param {Collection} collection - Collection
   */
  constructor (collection) {
    this.collection = collection
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
    return await this.collection.fetch('/file', {
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
    return await this.collection.fetch('/file/' + id, {
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
    if (!opts.headers) opts.headers = {}
    if (opts.range) {
      opts.headers.Range = `bytes=${opts.range.from || 0}-${opts.range.to || ''}`
    }
    return this.collection.fetch('/file/' + id, opts)
  }

  /**
   * Returns the HTTP url for a file.
   * @async
   * @param {string} id - A file ID
   * @return {Promise<string>} The file URL
   */
  async getURL (id) {
    return `${this.collection.endpoint}/file/${id}`
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
    return this.collection.fetch(`/file/${id}?meta=1`, opts)
  }
}

module.exports = Files

const { HYPERDRIVE_SCHEME } = require('./constants')
const parseUrl = require('parse-dat-url')

module.exports = class Fs {
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

  async listDrives () {
    // TODO: Move route under /fs somehow. Maybe HEAD on /?
    return this.collection.fetch('/fs-info')
  }

  async readdir (path) {
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

  async readFile (path, opts = {}) {
    opts.responseType = opts.responseType || 'buffer'
    opts.requestType = opts.requestType || 'buffer'
    return this.fetch(path, opts)
  }

  async createReadStream (path, opts = {}) {
    // opts.stream = true
    opts.responseType = 'stream'
    return this.readFile(path, opts)
  }

  async statFile (path) {
    return this.fetch(path)
  }
}

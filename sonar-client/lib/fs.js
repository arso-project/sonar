module.exports = class Fs {
  constructor (collection) {
    this.collection = collection
  }

  async request (method, path, opts) {
    if (!Array.isArray(path)) path = [path]
    return this.collection.request(method, ['fs', ...path], opts)
  }

  async listDrives () {
    // TODO: Move route under /fs somehow. Maybe HEAD on /?
    return this.collection.request('GET', 'fs-info')
  }

  async readdir (path) {
    const self = this
    path = path || '/'
    if (path === '/') {
      const drives = await this.getDrives()
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
    let files = await this.request('GET', path)
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

  async writeFile (path, file, opts) {
    if (!path || !path.length) throw new Error('path is required')
    if (path.startsWith('/')) path = path.substring(1)

    let onUploadProgress
    if (opts.onUploadProgress) {
      onUploadProgress = opts.onUploadProgress
      delete opts.onUploadProgress
    }

    return this.request('PUT', path, {
      data: file,
      params: opts,
      binary: true,
      onUploadProgress
    })
  }

  async readFile (path, opts = {}) {
    const { stream = true } = opts
    if (path.startsWith('/')) path = path.substring(1)
    const request = {
      binary: true
    }
    if (stream) request.responseType = 'stream'
    return this.request('GET', ['fs', 'path'], request)
  }

  async statFile (path) {
    if (path.startsWith('/')) path = path.substring(1)
    return this.request('GET', path)
  }
}

module.exports = class Fs {
  constructor (collection) {
    this.collection = collection
  }

  async fetch (path, opts) {
    if (!path.startsWith('/')) path = '/' + path
    path = '/fs' + path
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
    opts.requestType = undefined

    return this.fetch(path, {
      method: 'PUT',
      body: file,
      params: opts,
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

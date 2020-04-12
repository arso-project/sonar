const createServer = require('@arso-project/sonar-server')
const tmp = require('temporary-directory')
const fp = require('find-free-port')
const SonarClient = require('../../lib/client')

module.exports = class ServerClient {
  constructor (t, opts = {}) {
    this.t = t
    this.opts = {
      persist: false,
      ...opts
    }
    this.clients = []
    this.server = null
    this.serverClose = null
  }

  _tmpdir () {
    return new Promise((resolve, reject) => {
      tmp((err, dir, cleanup) => {
        if (err) reject(err)
        this.storage = dir
        this.storageCleanup = function () {
          return new Promise((resolve, reject) => {
            cleanup(err => err ? reject(err) : resolve())
          })
        }
        resolve(dir)
      })
    })
  }

  async _findPort () {
    const ports = await fp(20000)
    if (!ports.length) throw new Error('No free ports')
    this.port = ports[0]
    return this.port
  }

  async start (opts = {}) {
    try {
      if (!opts.storage) {
        await this._tmpdir()
      }
      if (!opts.port) {
        await this._findPort()
      } else {
        this.port = opts.port
      }
      await this.createServer()
      return this.createClient(opts)
    } catch (err) {
      this.t.fail(err)
      await this.stop()
      this.t.end()
    }
  }

  createServer (opts = {}) {
    opts = {
      ...this.opts,
      port: this.port,
      storage: this.storage,
      ...opts
    }
    this.server = createServer(opts)
    return new Promise((resolve, reject) => {
      this.server.start({ port: opts.port }, (err) => {
        if (err) reject(err)
        this.server.api.islands.ready((err) => {
          if (err) return reject(err)
          resolve(this.server)
        })
      })
    })
  }

  createClient (opts = {}) {
    const port = this.port
    const client = new SonarClient({
      endpoint: `http://localhost:${port}/api`,
      ...this.opts,
      ...opts
    })
    this.clients.push(client)
    return client
  }

  async stop () {
    try {
      for (const client of this.clients) {
        client.close()
      }
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close(err => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
      if (this.storageCleanup) await this.storageCleanup()
    } catch (err) {
      this.t.fail(err)
    }
    this.t.end()
  }
}

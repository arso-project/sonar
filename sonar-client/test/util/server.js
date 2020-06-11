const createServer = require('@arso-project/sonar-server')
const tmp = require('temporary-directory')
const fp = require('find-free-port')
const { SonarClient } = require('../..')
const debug = require('debug')('test')

// Increase stack trace limit during tests to get meaningful backtraces when CI breaks
Error.stackTraceLimit = Infinity

let CNT = 0
const PORT = process.env.PORT || 10000

class ServerClient {
  constructor (opts = {}) {
    this.opts = {
      persist: false,
      ...opts
    }
    this.clients = []
    this.server = null
    this.serverClose = null
    this._cnt = ++CNT
  }

  _createStorage (opts) {
    if (opts.storage) {
      this.storage = opts.storage
      return this.storage
    }
    return new Promise((resolve, reject) => {
      tmp('sonar-test', (err, dir, cleanup) => {
        if (err) reject(err)
        this.storage = dir
        this.storageCleanup = async function () {
          // Timeout makes test pass on Windows, otherwise the LevelDB
          // resource is still "BUSY".
          // TODO: Try to fix this.
          if (process.env.CI) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          return new Promise((resolve, reject) => {
            cleanup(err => err ? reject(err) : resolve())
          })
        }
        resolve(dir)
      })
    })
  }

  async _findPort (opts) {
    if (opts.port) {
      this.port = opts.port
    } else {
      const ports = await fp(process.env.PORT || (PORT + this._cnt))
      if (!ports.length) throw new Error('No free ports')
      this.port = ports[0]
    }
    return this.port
  }

  async start (opts = {}) {
    try {
      await this.createServer(opts)
      const client = this.createClient(opts)
      return client
    } catch (err) {
      await this.stop()
      throw err
    }
  }

  async createServer (opts = {}) {
    opts = {
      ...this.opts,
      ...opts
    }
    opts.storage = await this._createStorage(opts)
    opts.port = await this._findPort(opts)
    this.server = createServer(opts)
    return new Promise((resolve, reject) => {
      this.server.start((err) => {
        if (err) reject(err)
        this.server.api.collections.ready((err) => {
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
    debug('server closed')
    if (this.storageCleanup) await this.storageCleanup()
    debug('storage deleted')
  }
}

async function createServerClient (opts) {
  opts = Object.assign({
    network: false,
    collection: 'default'
  }, opts || {})
  const context = new ServerClient(opts)
  const client = await context.start()
  if (opts.collection) await client.createCollection(opts.collection)
  return [context, client]
}

module.exports = createServerClient
module.exports.ServerClient = ServerClient

const maybe = require('call-me-maybe')
const debug = require('debug')('sonar:rpc')
const { Readable, Writable } = require('streamx')
const { EventEmitter } = require('events')
const FreeMap = require('freemap')
const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const net = require('net')

const HRPC = require('..')
const getNetworkOptions = require('../socket')

class Sessions {
  constructor () {
    this._cores = new FreeMap()
    this._resourceCounter = 1
  }

  create (resource) {
    return this._cores.add(resource)
  }

  createResourceId () {
    return this._resourceCounter++
  }

  delete (id) {
    this._cores.free(id)
  }

  get (id) {
    return this._cores.get(id)
  }
}

module.exports = class SonarClient {
  constructor (opts = {}) {
    const sessions = new Sessions()

    this._socketOpts = getNetworkOptions(opts)
    this._client = HRPC.connect(this._socketOpts)
    this.commands = new RemoteCommands({ client: this._client, sessions })
    this.collections = new RemoteCollections({ client: this._client, sessions })
  }

  static async serverReady (opts) {
    const sock = getNetworkOptions(opts)
    return new Promise((resolve) => {
      retry()

      function retry () {
        const socket = net.connect(sock)
        let connected = false

        socket.on('connect', function () {
          connected = true
          socket.destroy()
        })
        socket.on('error', socket.destroy)
        socket.on('close', function () {
          if (connected) return resolve()
          setTimeout(retry, 100)
        })
      }
    })
  }

  // status (cb) {
  //   return maybe(cb, this._client.hyperspace.status())
  // }

  // close () {
  //   return this._client.destroy()
  // }

  // ready (cb) {
  //   return maybe(cb, this.network.ready())
  // }
}

function noop () {}

class RemoteCollections extends EventEmitter {
  constructor (opts = {}) {
    super()
    const self = this

    this.name = opts.name || null
    this._client = opts.client
    this._sessions = opts.sessions || new Sessions()

    this._client.collection.onRequest({
      onResults (req) {
        const { resourceId, records, meta, finished, error } = req
        const stream = self._sessions.get(resourceId)
        if (!stream) return
        for (const record of records) {
          stream.push(record)
        }
        if (finished) {
          stream.push(null)
        }
        if (error) {
          const err = new Error('Remote error: ' + error.message || 'Unknown remote error')
          err.code = error.code
          stream.destroy(err)
        }
      }
    })
  }

  async get ({ key, name }) {
    const collection = new RemoteCollection({
      client: this._client,
      sessions: this._sessions,
      key,
      name
    })
    await collection.open()
    return collection
  }
}

class RemoteCollection {
  constructor (opts) {
    this._client = opts.client
    this._sessions = opts.sessions || new Sessions()
    this.key = opts.key
    this.name = opts.name
  }

  async open () {
    this._id = this._sessions.create(this)
    const res = await this._client.collection.open({
      id: this._id,
      key: this.key,
      name: this.name
    })
    this.key = res.key
    this.name = res.name
  }

  async publish (records) {
    for (const record of records) {
      record.value = Buffer.from(JSON.stringify(record.value))
    }
    const req = {
      id: this._id,
      records
    }
    console.log('pub req', req)
    const res = await this._client.collection.publish(req)
    console.log('pub res', res)
    return res
  }

  createQueryStream (name, args, opts = {}) {
    opts.stream = true
    const stream = new Readable()
    const resourceId = this._sessions.create(stream)
    this._client.query({
      id: this._id,
      resourceId,
      name,
      args,
      opts
    }).catch(err => {
      stream.destroy(err)
      this._sessions.delete(resourceId)
    })
    return stream
  }

  async query (name, args, opts = {}) {
    opts.stream = false
    const req = {
      id: this._id,
      name,
      args: Buffer.from(JSON.stringify(args)),
      stream: opts.stream,
      live: opts.live
    }
    console.log('query req', req)
    const res = await this._client.collection.query(req)
    console.log('query res', res)
    return res
  }
}

class RemoteCommands extends EventEmitter {
  constructor (opts = {}) {
    super()

    this.name = opts.name || null
    this._client = opts.client
    this._sessions = opts.sessions || new Sessions()

    this._client.commands.onRequest(this, {
      stream (req) {
        debug('onreq stream', req)
        const { resourceId, streamId, data, finished, error, code } = req
        const state = this._sessions.get(resourceId)
        if (!state) throw new Error('Invalid command resource id.')

        if (finished) {
          process.nextTick(() => {
            state.close()
          })
          return
        }

        let stream
        if (streamId === 0) {
          stream = state.stdout
        } else if (streamId === 1) {
          stream = state.stderr
        } else {
          throw new Error('Invalid stream ID')
        }
        if (data) stream.push(data)
        if (finished) stream.end()
      }
    })
  }

  async command (command, args, env) {
    const state = new RemoteCommand()
    const resourceId = this._sessions.create(state)
    state.id = resourceId

    args = args.map(arg => ({ value: arg }))
    const res = await this._client.commands.command({
      resourceId,
      command,
      args
      // env
    })
    debug('command res', res)
    if (res.value) state.value = res.value
    return state
  }
}

class RemoteCommand extends EventEmitter {
  constructor () {
    super()
    const self = this
    this.stdin = new Writable({
      write (data, callback) {
        self._client.commands.streamNoReply({
          resourceId: self.id,
          streamId: 0,
          data
        })
        callback()
      }
    })
    this.stdout = new Readable()
    this.stderr = new Readable()
  }

  close () {
    this.stdout.destroy()
    this.stderr.destroy()
    this.stdin.destroy()
    console.log('emit close')
    this.emit('close')
  }
}

// function randomNamespace () { // does *not* have to be secure
//   let ns = ''
//   while (ns < 64) ns += Math.random().toString(16).slice(2)
//   return ns.slice(0, 64)
// }

// function maybeOptional (cb, prom) {
//   prom = maybe(cb, prom)
//   if (prom) prom.catch(noop)
//   return prom
// }

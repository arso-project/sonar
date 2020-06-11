const debug = require('debug')('sonar-client')
const { Endpoint } = require('simple-rpc-protocol')
const Socket = require('simple-websocket')

module.exports = class CommandStreamClient {
  constructor (opts) {
    this._url = opts.url
    this._env = opts.env
    this._name = opts.name
    this._commands = opts.commands
    this._socket = null
    this._endpoint = null
  }

  setEnv (key, value) {
    this._env[key] = value
  }

  close () {
    if (this._closed) return
    this._closed = true
    if (this._endpoint) this._endpoint.close()
    if (this._socket) this._socket.destroy()
  }

  async call (command, args, env = {}) {
    if (this._closed) throw new Error('Stream closed')
    await this.open()
    env = { ...this._env, ...env }
    return new Promise((resolve, reject) => {
      this._endpoint.call(command, args, env, (err, msg, channel) => {
        if (err) return reject(err)
        resolve([channel, msg])
      })
    })
  }

  async callStreaming (command, args, env) {
    if (this._closed) throw new Error('Stream closed')
    await this.open()
    env = { ...this._env, ...env }
    return this._endpoint.callStream(command, args, env)
  }

  async open () {
    if (!this._initPromise) this._initPromise = this._init()
    await this._initPromise
    debug('command stream open')
  }

  _init () {
    const self = this
    return new Promise((resolve, reject) => {
      let resolved = false
      const url = this._url.replace(/^http/, 'ws')
      this._socket = new Socket(url)
      this._socket.once('connect', onconnect)
      this._socket.on('error', onerror)

      function onconnect () {
        debug('socket connected')
        self._endpoint = new Endpoint({
          stream: self._socket, name: self._name
        })
        if (self._commands) {
          self._endpoint.commands(self._commands)
        }
        self._endpoint.on('remote-manifest', manifest => {
          debug('endpoint received manifest', manifest)
          self._remoteManifest = manifest
          if (!resolved) {
            resolved = true
            resolve()
          }
        })
        self._endpoint.on('close', () => {
          debug('endpoint closed')
        })
        self._endpoint.announce()
      }

      function onerror (err) {
        if (!resolved) {
          resolved = true
          reject(err)
        }
        debug('socket error', err)
      }
    })
  }
}

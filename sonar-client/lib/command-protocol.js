const { EventEmitter } = require('events')
const { Readable, Duplex } = require('streamx')

// quick util
// const bind = (self, fn) => (...args) => fn.call(self, ...args)

class CommandRouter extends EventEmitter {
  constructor (opts = {}) {
    super()
    this._name = opts.name
    this._services = opts.services || {}
    this._connections = new Set()

    this.createManifest = this.createManifest.bind(this)
    this.oncommand = this.oncommand.bind(this)
    this.onhello = this.onhello.bind(this)
  }

  service (name, { commands, oncommand }) {
    if (this._services[name]) this.emit('error', new Error('Name in use: ' + name))
    this._services[name] = {
      name,
      local: true,
      commands,
      oncommand
    }
  }

  connection (isInitiator, socket) {
    const protocol = new CommandProtocol(isInitiator, {
      socket,
      name: this._name,
      oncommand: this.oncommand,
      onhello: this.onhello,
      createManifest: this.createManifest
    })
    this._connections.add(protocol)
    return protocol
  }

  createManifest () {
    const commands = {}
    for (const service of Object.values(this._services)) {
      for (let [name, cmd] of Object.entries(service.commands)) {
        const cmdname = `@${service.name} ${name}`
        commands[cmdname] = {
          help: cmd && cmd.help
        }
      }
    }
    return { commands, name: this._name }
  }

  oncommand (cmd, args, channel, protocol) {
    const parsed = parseDirected(cmd)
    if (!parsed || !this._services[parsed.name]) return channel.error(new Error('Command not found'))
    const { name, command } = parsed

    const service = this._services[name]

    if (service.local) {
      if (service.commands[command]) return service.commands[command].oncall(args, channel)
      if (service.oncommand) return service.oncommand(cmd, args, channel)
      return channel.error(new Error('Command not found'))
    }

    const remoteChannel = service.protocol.call(command, args)
    remoteChannel.onmessage = function (type, msg) {
      channel.send(type, msg)
    }
    channel.on('data', data => remoteChannel.write(data))
  }

  onhello (msg, protocol) {
    const { name } = msg
    if (this._services[name]) return protocol.destroy(new Error('Name in use: ' + name))
    this._services[name] = {
      name,
      local: false,
      protocol,
      get commands () {
        return protocol.remoteCommands()
      }
    }

    Object.values(this._services).forEach(service => {
      if (service.protocol) service.protocol.hello()
    })
  }
}

function parseDirected (cmd) {
  if (!cmd.startsWith('@')) return false
  let [name, ...other] = cmd.trim().substring(1).split(/ (.+)/)
  const command = other.join(' ').trim()
  if (!command.length) return false
  return { name, command }
}

class CommandProtocol {
  constructor (isInitiator, opts) {
    this.isInitiator = isInitiator
    this._context = opts.context || this
    this._oncommand = opts.oncommand
    this._send = opts.send
    this._name = opts.name
    this._createManifest = opts.createManifest
    this._onhello = opts.onhello

    this._open = false
    this._channelcnt = isInitiator ? -1 : 0
    this._commands = opts.commands || {}
    this._channels = {}

    this._remoteName = null
    this._remoteCommands = {}

    if (opts.socket) {
      this._send = function (msg) { opts.socket.write(msg) }
      opts.socket.on('data', data => this.recv(data))
    }
    this.hello()
  }

  _nextid () {
    this._channelcnt = this._channelcnt + 2
    return this._channelcnt
  }

  // command (name, oncall, opts = {}) {
  //   opts.command = name
  //   this._commands[name] = { oncall, opts, name }
  //   return this
  // }

  createManifest () {
    if (this._createManifest) return this._createManifest()
    const commands = Object.entries(this._commands).reduce((spec, [name, cmd]) => {
      spec[name] = { name, help: cmd.opts && cmd.opts.help }
      return spec
    }, {})
    return {
      commands,
      name: this._name
    }
  }

  call (cmd, args, cb) {
    const ch = this._nextid()
    this._channels[ch] = new CommandChannel(this, ch, cb)
    this._channels[ch].call(cmd, args)
    return this._channels[ch]
  }

  hello () {
    const manifest = this.createManifest()
    this.send(0, 0, manifest)
  }

  send (ch, type, msg) {
    if (this.closed) this.destroy(new Error('Send after close'))
    const message = JSON.stringify([ch, type, msg])
    this._send(message)
  }

  // log (...args) {
  //   console.log(this.isInitiator ? '[c]' : '[s]', ...args)
  // }

  recv (message) {
    if (this.closed) return this.destroy(new Error('Receive after close'))
    const [ch, type, msg] = JSON.parse(message)
    if (ch === 0 && type === 0) return this.onhello(msg)
    if (ch === 0 && type === 15) return this.onextension(msg)

    // TODO: Allow commands without hello?
    if (!this._opened) return this.destroy(new Error('Command before hello'))
    if (type === 1 && !this._channels[ch]) {
      this._channels[ch] = new CommandChannel(this, ch)
    }
    if (this._channels[ch]) return this._channels[ch].recv(type, msg)
    this.destroy(new Error('Invalid message'))
  }

  onhello (msg) {
    // this.log('onhello', msg)
    const { name, commands, uncommands } = msg
    if (this._authenticate && !this._authenticate(msg)) return this.destroy(new Error('Not authorized'))
    this._remoteName = name
    if (commands) this._remoteCommands = Object.assign(this._remoteCommands, commands)
    if (uncommands) uncommands.forEach(name => delete this._remoteCommands[name])
    if (this._onhello) this._onhello({ name, commands }, this)
    this._opened = true
    // if (!this.isInitiator) this.hello()
  }

  onextension (msg) {
    if (this._onextension) this._onextension(msg)
  }

  remoteCommands () {
    return this._remoteCommands
  }

  oncommand (cmd, args, channel) {
    // this.log('oncommand', cmd, args)
    if (this._commands[cmd]) return this._commands[cmd].oncall(args, channel, this._context)
    if (this._oncommand) return this._oncommand(cmd, args, channel, this._context)
    this.destroy(new Error('Command not supported'))
  }

  destroy (err) {
    if (err) this.error = err
    this.closed = true
  }
}

class CommandChannel extends Duplex {
  constructor (stream, id, callback) {
    super()
    this.stream = stream
    this.id = id
    if (callback) this.callback = once(callback)
    // this.stream.log('create', id, callback)
  }

  call (cmd, args) {
    if (this.opened) return this.destroy(new Error('Command channel already open'))
    this.opened = true
    const msg = JSON.stringify([cmd, args])
    this.send(1, msg)
  }

  reply (msg) {
    if (!this.opened) return this.destroy(new Error('Reply before open'))
    if (this.replied) return this.destroy(new Error('Reply already sent'))
    this.send(2, msg)
    this.replied = true
  }

  error (msg) {
    this.send(3, msg.toString())
  }

  write (msg) {
    if (!this.opened) return this.destroy('Write before open')
    this.send(4, msg)
  }

  send (type, msg) {
    this.stream.send(this.id, type, msg)
  }

  recv (type, msg) {
    if (this.closed) this.destroy(new Error('Write after close'))
    if (this.onmessage) return this.onmessage(type, msg)
    if (type === 1) return this.oncall(msg)
    if (type === 2) return this.onreply(msg)
    if (type === 3) return this.onerror(msg)
    if (type === 4) return this.ondata(msg)
    this.destroy(new Error('Unsupported type: ' + type))
  }

  oncall (msg) {
    if (this.opened) return this.destroy(new Error('Cannot open on channel opened by remote'))
    const [cmd, args] = JSON.parse(msg)
    this.opened = true
    this.stream.oncommand(cmd, args, this)
  }

  onreply (msg) {
    if (this.callback) this.callback(null, msg, this)
    this.emit('reply', msg)
    this.destroy()
  }

  onerror (err) {
    if (this.callback) this.callback(err, undefined, this)
    this.emit('remote-error', err)
    // console.error('ERR', err)
    // this.emit('error', err)
    // this.destroy()
  }

  createLogStream () {
    const stream = new Readable()
    this.on('remote-error', err => stream.push(err))
    return stream
  }

  ondata (msg) {
    if (!this.opened) return this.destroy(new Error('Write before open'))
    this.push(msg)
  }
}

function once (cb) {
  let fn = cb
  return function (...args) {
    fn(...args)
    fn = function () {}
  }
}

module.exports = {
  CommandProtocol,
  CommandRouter
}

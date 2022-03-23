const { EventEmitter } = require('events')
const { Readable } = require('streamx')
const base32 = require('base32')
const { randomBytes } = require('crypto')
// const EventStream = require('@arsonar/core/lib/utils/eventstream.js')

const kCallbacks = Symbol('callbacks')
module.exports = class BotBackend {
  constructor () {
    this.bots = new Map()
    this.sessions = new Map()
  }

  async register (spec, sessionId) {
    // const { name, info, commands, config, types } = spec
    if (sessionId && !this.sessions.has(sessionId)) {
      throw new Error('Invalid session ID')
    }

    // console.log('REGISTER BOT', { spec, sessionId })
    const name = spec.name
    if (!name) throw new Error('Name is required')
    if (this.bots.has(spec.name))
      throw new Error(`Bot ${name} already registered`)

    // TODO: This would be the step to check auth
    if (!sessionId) sessionId = randomId()
    const session = new Session(sessionId)
    this.sessions.set(sessionId, session)

    const remoteBot = new RemoteBot(session, spec)
    session.bots.set(name, remoteBot)
    this.bots.set(name, remoteBot)
    // TODO: Load config, and persist on configure()
    return {
      sessionId,
      config: remoteBot.config
    }
  }

  info () {
    const info = {}
    for (const [name, bot] of this.bots.entries()) {
      info[name] = bot.spec
    }
    return info
  }

  async join (botName, collection) {
    if (!this.bots.has(botName))
      throw new Error(`Bot ${botName} not registered`)

    const remoteBot = this.bots.get(botName)
    return remoteBot.join(collection)
  }

  async leave (botName, collection) {
    if (!this.bots.has(botName))
      throw new Error(`Bot ${botName} not registered`)
    const remoteBot = this.bots.get(botName)
    return remoteBot.leave(collection)
  }

  getSession (sessionId) {
    const session = this.sessions.get(sessionId)
    return session
  }

  getBot (name) {
    if (!this.bots.has(name)) throw new Error(`Bot ${name} not registered`)
    return this.bots.get(name)
  }
}

class Session extends EventEmitter {
  constructor (id) {
    super()
    this.id = id
    this.bots = new Map()
    this._eventStream = new EventStream(100)

    this._requestIdCounter = 0
    this._requests = new Map()
  }

  createRequestId () {
    return ++this._requestIdCounter
  }

  recvReply (message) {
    const { requestId, result, error } = message
    const request = this._requests.get(requestId)
    if (!request) throw new Error('Invalid request ID')
    request.status = error ? 'error' : 'success'
    request.error = error
    request.result = result
    if (request.error) request[kCallbacks].reject(request)
    else request[kCallbacks].resolve(request)
    // TODO: Check if this is performant enough with many listeners.
    // This is caught by the promise in RemoteBot.request()
    // this.emit('reply:' + requestId, request)

    // TODO: Notify clients
    // this._clientStream.push({ requestId, request })
    // this.emit('reply', { requestId, result, error })
  }

  // pushBotEvent (event) {
  // }

  // pushClientEvent (event) {
  // }

  pushRequest (message) {
    const startDate = Date.now()
    const { requestId } = message
    const request = { status: 'pending', requestId, startDate }
    const promise = new Promise((resolve, reject) => {
      request[kCallbacks] = { resolve, reject }
    })
    this._requests.set(requestId, request)
    this._eventStream.push(message)
    return promise
  }

  createEventStream (lastEventId) {
    return this._eventStream.subscribe(lastEventId)
  }

  getBot (botName) {
    return this.bots.get(botName)
  }
}

class RemoteBot {
  constructor (session, spec) {
    this.session = session
    this._requests = session._requests
    this.name = spec.name
    this.spec = spec
    this.collections = new Set()
    this.config = {}
  }

  commandStatus (requestId) {
    return this._requests.get(parseInt(requestId))
  }

  status () {
    return Object.fromEntries(this._requests)
  }

  async join (collection) {
    await this._request('join', { collection })
    this.collections.add(collection)

    // TODO: Wait for OK from bot?
    // await the reply
  }

  async leave (collection) {
    await this._request('leave', { collection })
    // TODO: Wait for OK from bot?
    this.collections.delete(collection)
  }

  async command (command, args, env) {
    if (env.collection && !this.collections.has(env.collection)) {
      throw new Error(
        `Bot ${this.name} did not join collection ${env.collection}`
      )
    }
    // TODO: Validate before sending? We have the spec available for this.
    return this._request('command', {
      env,
      command,
      args
    })
  }

  async _request (op, data) {
    const requestId = this.session.createRequestId()
    const message = {
      requestId,
      bot: this.name,
      op,
      data
    }
    return this.session.pushRequest(message)
  }

  // pushCommand (collection, command, args) {
  //   if (!this.collections.has(collection)) throw new Error('Bot not joined')
  //   const requestId = this._pushMessage('command', {
  //     collection,
  //     command,
  //     args
  //   })
  //   return requestId
  //   // this.push
  // }
}

function randomId () {
  return base32.encode(randomBytes(16))
}

class EventStream {
  constructor (capacity) {
    this._capacity = capacity
    this._messages = []
    this._counter = 0
    this._subscribers = new Set()
  }

  push (message) {
    message.id = ++this._counter
    if (this._messages.length === this._capacity) {
      this._messages.shift()
    }
    this._messages.push(message)
    for (const subscriber of this._subscribers) {
      process.nextTick(() => subscriber.push(message))
    }
  }

  subscribe (lastId) {
    const stream = new Readable()
    if (lastId) {
      let nMissed = this.counter - lastId
      if (nMissed > this._messages.length) {
        nMissed = this._messages.length
      }
      const start = this._messages.length - nMissed
      const end = this._messages.length
      for (let i = start; i <= end; i++) {
        stream.push(this._messages[i])
      }
    }
    this._subscribers.add(stream)
    stream.on('destroy', () => this._subscribers.delete(stream))
    return stream
  }
}

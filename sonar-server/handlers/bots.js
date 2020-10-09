const express = require('express')
const { EventEmitter } = require('events')
const { HttpError } = require('../lib/util')
const { Readable } = require('streamx')
const base32 = require('base32')
const { randomBytes } = require('crypto')
const SseStream = require('ssestream').default

const SESSION_HEADER = 'x-sonar-bot-session-id'

class BotBackend {
  constructor (collections) {
    this.collections = collections
    this.bots = new Map()
    this.sessions = new Map()
  }

  async announce (spec, sessionId) {
    // const { name, info, commands, config, types } = spec
    if (sessionId && !this.sessions.has(sessionId)) {
      throw new Error('Invalid session ID')
    }

    const name = spec.name
    if (!name) throw new Error('Name is required')
    if (this.bots.has(spec.name)) throw new Error(`Bot ${name} already registered`)

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
    if (!this.bots.has(botName)) throw new Error(`Bot ${botName} not registered`)

    const remoteBot = this.bots.get(botName)
    return remoteBot.join(collection)
  }

  async leave (botName, collection) {
    if (!this.bots.has(botName)) throw new Error(`Bot ${botName} not registered`)
    const remoteBot = this.bots.get(botName)
    remoteBot.leave(collection)
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

class LoggingTeeStream {
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

class Session extends EventEmitter {
  constructor (id) {
    super()
    this.id = id
    this.bots = new Map()
    this._eventStream = new LoggingTeeStream(100)

    this._requestIdCounter = 0
    this._requests = new Map()
  }

  createRequestId () {
    return ++this._requestIdCounter
  }

  reply (message) {
    const { requestId, result, error } = message
    const request = this._requests.get(requestId)
    if (!request) throw new Error('Invalid request ID')
    request.status = error ? 'error' : 'success'
    request.error = error
    request.result = result
    // TODO: Check if this is performant enough with many listeners.
    // This is caught by the promise in RemoteBot.request()
    this.emit('reply:' + requestId, request)

    // TODO: Notify clients
    // this._clientStream.push({ requestId, request })
    // this.emit('reply', { requestId, result, error })
  }

  // pushBotEvent (event) {
  // }

  // pushClientEvent (event) {
  // }

  pushMessage (message) {
    const startDate = Date.now()
    const { requestId } = message
    this._requests.set(requestId, { status: 'pending', requestId, startDate })
    this._eventStream.push(message)
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

  async request (op, data) {
    const requestId = this._pushMessage(op, data)
    return new Promise((resolve, reject) => {
      this.session.once('reply:' + requestId, status => {
        resolve(status)
      })
    })
  }

  commandStatus (requestId) {
    return this._requests.get(parseInt(requestId))
  }

  status () {
    return Object.fromEntries(this._requests)
  }

  async join (collection) {
    await this.request('join', { collection })
    this.collections.add(collection)

    // TODO: Wait for OK from bot?
    // await the reply
  }

  async leave (collection) {
    await this.request('leave', { collection })
    // TODO: Wait for OK from bot?
    this.collections.delete(collection)
  }

  async command (collection, command, args) {
    return await this.request('command', {
      collection,
      command,
      args
    })
  }

  _pushMessage (op, data) {
    const requestId = this.session.createRequestId()
    const message = {
      requestId,
      bot: this.name,
      op,
      data
    }
    this.session.pushMessage(message)
    return requestId
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

module.exports = function createBotRouter (collections) {
  const router = express.Router()
  const bots = new BotBackend(collections)

  router.use((req, res, next) => {
    const sessionId = req.header(SESSION_HEADER)
    if (sessionId) {
      req.botSession = bots.getSession(sessionId)
    }
    next()
  })

  // Routes for bot consumers
  //
  // Control bots (join, leave, commands) from UI/CLI

  router.post('/join', ah(async (req, res) => {
    const { bot: name, collection } = req.body
    await bots.join(name, collection)
    res.send({})
  }))

  router.post('/leave', ah(async (req, res) => {
    const { bot: name, collection } = req.body
    await bots.leave(name, collection)
    res.send({})
  }))

  // Post a command to a bot
  //
  // This is used by UI or CLI to post a command to a bot.
  router.post('/command/:bot/:collection', ah(async (req, res) => {
    const { collection: collectionKey, bot: botName } = req.params
    const { command, args } = req.body
    const remoteBot = bots.getBot(botName)
    // const requestId = remoteBot.pushCommand(collectionKey, command, args)
    const status = await remoteBot.command(collectionKey, command, args)
    res.send(status)
    // const requestId = remoteBot.pushCommand(collectionKey, command, args)
    // res.send({ requestId })
  }))

  router.get('/info', ah(async (req, res) => {
    const info = bots.info()
    res.send(info)
  }))

  router.get('/status', ah(async (req, res) => {
    const status = bots.status()
    res.send(status)
  }))

  router.get('/status/:bot/:requestId', ah(async (req, res) => {
    const { requestId, bot: botName } = req.params
    const bot = bots.getBot(botName)
    const commandStatus = bot.commandStatus(requestId)
    res.send(commandStatus)
  }))

  router.post('/configure/:name', ah(async (req, res) => {
    const config = req.body
    const { name } = req.params
    const updatedConfig = await bots.configure(name, config)
    res.send(updatedConfig)
  }))

  // Routes with active sessions (for bot providers)
  //

  router.post('/announce', ah(async (req, res) => {
    const spec = req.body
    const { config, sessionId } = await bots.announce(spec)
    res.send({ config, sessionId })
  }))

  router.post('/reply', ah(async (req, res) => {
    if (!req.botSession) throw MissingSessionError()
    const { requestId, result, error } = req.body
    const { botSession } = req
    botSession.reply({ requestId, result, error })
    // const remoteBot = botSession.getBot(botName)
    // remoteBot.reply(requestId, { result, error })
    res.send({})
  }))

  router.get('/events', (req, res, next) => {
    if (!req.botSession) throw MissingSessionError()
    const { botSession } = req

    const lastEventId = req.header('Last-Event-ID')

    const eventStream = botSession.createEventStream(lastEventId)
    const sseStream = new SseStream(req)
    sseStream.pipe(res)

    eventStream.on('data', message => {
      const data = JSON.stringify(message)
      sseStream.write({
        id: message.id,
        // TODO: It would be nicer to pass the message type here.
        // However, the EventSource API doesn't really allow a
        // catch-all handler.
        event: 'message',
        data
        // retry,
        // comment
      })
    })

    res.on('close', () => {
      sseStream.unpipe(res)
      eventStream.destroy()
    })
  })

  return router
}

function MissingSessionError () {
  return HttpError(403, 'Missing session header')
}

function randomId () {
  return base32.encode(randomBytes(16))
}

// Wrap request handlers so that they can throw errors.
function ah (asyncfn) {
  return async function (req, res, next) {
    try {
      await asyncfn(req, res, next)
    } catch (err) {
      next(err)
    }
  }
}

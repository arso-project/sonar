const express = require('express')
const { HttpError } = require('../lib/util')
const SseStream = require('ssestream').default
const ah = require('../lib/async-handler')

const BotBackend = require('@arsonar/bots/lib/backend')

const SESSION_HEADER = 'x-sonar-bot-session-id'

module.exports = function createBotRouter () {
  const router = express.Router()
  const bots = new BotBackend()

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
  router.post('/command', ah(async (req, res) => {
    const {
      // collection: collectionKey,
      bot: botName,
      command,
      args,
      env
    } = req.body
    const remoteBot = bots.getBot(botName)
    // const requestId = remoteBot.pushCommand(collectionKey, command, args)
    const status = await remoteBot.command(command, args, env)
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

  router.post('/register', ah(async (req, res) => {
    const spec = req.body
    const { config, sessionId } = await bots.register(spec)
    res.send({ config, sessionId })
  }))

  router.post('/reply', ah(async (req, res) => {
    if (!req.botSession) throw MissingSessionError()
    const { requestId, result, error } = req.body
    const { botSession } = req
    botSession.recvReply({ requestId, result, error })
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

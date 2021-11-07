const debug = require('debug')('sonar:bots')

const SESSION_HEADER = 'X-Sonar-Bot-Session-Id'

class Bots {
  constructor (workspace) {
    this.workspace = workspace
    this.bots = new Map()
    this.log = this.workspace.log.child({ name: 'bots' })
  }

  async close () {
    this._eventSource.close()
  }

  async join (botName, collection) {
    const res = await this.fetch('/join', {
      method: 'POST',
      body: { bot: botName, collection }
    })
    return res
  }

  async leave (botName, collection) {
    const res = await this.fetch('/leave', {
      method: 'POST',
      body: { bot: botName, collection }
    })
    return res
  }

  async info () {
    const res = await this.fetch('/info')
    return res
  }

  async command (botName, command, args, env) {
    const path = '/command'
    const res = await this.fetch(path, {
      method: 'POST',
      body: { bot: botName, command, args, env }
    })
    return res
  }

  async commandStatus (botName, requestId) {
    const path = `/status/${botName}/${requestId}`
    const res = await this.fetch(path)
    return res
  }

  async getCommands () {
  }

  async _initListener () {
    this._init = true

    // const path = this.workspace.endpoint + '/bot/events'
    // const headers = {
    //   ...this.workspace.getAuthHeaders(),
    //   ...this.getHeaders()
    // }

    const path = '/bot/events'
    this._eventSource = this.workspace.createEventSource(path, {
      headers: this.getHeaders(),
      onmessage: this._onmessage.bind(this),
      onerror: err => {
        // TODO: Where do these errors go?
        // TODO: After a couple of fails die.
        this.log.error({ err, message: 'Event source error' })
      }
    })
    // this._eventSource = new EventSource(path, { headers })
    // this._eventSource.addEventListener('message', message => {
    //   try {
    //     const event = JSON.parse(message.data)
    //     this._onmessage(event)
    //   } catch (e) {}
    // })
    // this._eventSource.addEventListener('error', err => {
    //   // TODO: Where do these errors go?
    //   // TODO: After a couple of fails die.
    //   this.log.error({ err, message: 'Event source error' })
    // })
  }

  async reply ({ requestId, error, result }) {
    await this.fetch('/reply', {
      method: 'POST',
      body: {
        requestId,
        error,
        result
      }
    })
  }

  async _onmessage (message) {
    console.log('onmessage', message)
    try {
      const { bot: name, op, data, requestId } = message
      const bot = this.bots.get(name)
      if (!bot) throw new Error('Unknown bot: ' + bot)
      try {
        if (op === 'join') {
          const { collection: collectionKey } = data
          const collection = await this.workspace.openCollection(collectionKey)
          await bot.onjoin(collection, data.config)
          await this.reply({ requestId })
        } else if (op === 'leave') {
          const { collection: collectionKey } = data
          const collection = await this.workspace.openCollection(collectionKey)
          await bot.onleave(collection)
          await this.reply({ requestId })
        } else if (op === 'command') {
          const { command, args, env } = data
          if (env.collection) {
            env.collection = await this.workspace.openCollection(env.collection)
          }
          const result = await bot.oncommand(command, args, env)
          await this.reply({ requestId, result })
        }
      } catch (err) {
        console.error(err)
        // this.log.error({ message: 'bot onmessage handle error: ' + err.message + ' from ' + JSON.stringify(message), err })
        this.log.error({ message: 'bot onmessage handle error: ' + err.message, err })
        debug(err)
        await this.reply({
          requestId: requestId,
          error: err.message
        })
      }
    } catch (err) {
      // TODO: Where to these errors go?
      this.log.error({ message: 'bot onmessage error', err })
      console.error(err)
    }
  }

  getHeaders () {
    const headers = {}
    if (this._sessionId) {
      headers[SESSION_HEADER] = this._sessionId
    }
    return headers
  }

  async fetch (url, opts = {}) {
    url = '/bot' + url
    opts.headers = opts.headers || {}
    opts.headers = { ...this.getHeaders(), ...opts.headers }
    return this.workspace.fetch(url, opts)
  }

  async register (name, spec, handlers) {
    if (typeof spec !== 'object') throw new Error('Spec must be an object')
    spec.name = name
    const { config, sessionId } = await this.fetch('/register', {
      method: 'POST',
      body: spec
    })
    this._sessionId = sessionId
    if (!this._init) await this._initListener()
    this.bots.set(name, new Bot({
      spec,
      workspace: this.workspace,
      config,
      handlers
    }))
  }

  // async configure (name, config) {
  //   const config = await this.workspace.fetch('/bot/configure/' + name, config)
  // }
}

class Bot {
  constructor ({ spec, config, handlers, workspace }) {
    this.spec = spec
    this.name = spec.name
    this.workspace = workspace
    this.config = config
    if (typeof handlers === 'function') {
      handlers = handlers({ spec, config, workspace })
    }
    this.handlers = handlers
    this.sessions = new Map()
    this.opened = false
    this.log = this.workspace.log.child({ name: 'bot:' + this.name })
  }

  async open () {
    if (this.opened) return
    if (this.opening) return this.opening
    let _resolve
    this.opening = new Promise(resolve => (_resolve = resolve))
    if (this.handlers.open) await this.handlers.open()
    _resolve()
    this.opened = true
    this.log.debug('open')
  }

  async onjoin (collection, config) {
    await this._ensureTypes(collection)
    await this.open()
    if (!this.opened && this.handlers.open) {
      await this.handlers.open()
      this.opened = true
    }
    const session = await this.handlers.onjoin(collection, config)
    if (session.open) {
      await session.open()
    }
    if (session.onrecord) {
      collection.subscribe('bot:' + this.name, session.onrecord.bind(session))
    }
    this.sessions.set(collection.key, session)
    this.log.debug({ message: 'join', collection })
  }

  async _ensureTypes (collection) {
    if (!this.spec.types) return
    for (const typeSpec of this.spec.types) {
      if (!collection.schema.hasType(typeSpec)) {
        await collection.putType(typeSpec)
      }
    }
  }

  async onleave (collection) {
    const session = this.sessions.get(collection.key)
    if (!session) return
    if (session.close) await session.close()
    this.sessions.delete(collection.key)
    this.log.debug({ message: 'leave', collection })
  }

  async oncommand (command, args, env) {
    await this.open()

    if (!env.collection && this.handlers.oncommand) {
      this.log.debug('workspace command: ' + command)
      return await this.handlers.oncommand(command, args)
    }

    this.log.debug({ message: 'collection command: ' + command, collection: env.collection })
    const session = this.sessions.get(env.collection.key)
    if (!session) throw new Error('Bot did not join collection')
    if (!session.oncommand) throw new Error('Bot cannot handle commands')

    return await session.oncommand(command, args)
  }
}

module.exports = Bots
module.exports.Bots = Bots

const EventSource = require('eventsource')

const SESSION_HEADER = 'X-Sonar-Bot-Session-Id'

class Bots {
  constructor (client) {
    this.client = client
    this.bots = new Map()
  }

  async close () {
    this._eventSource.close()
  }

  async join (bot, collection) {
    const res = await this.fetch('/join', {
      method: 'POST',
      body: { bot, collection }
    })
    return res
  }

  async leave (bot, collection) {
    const res = await this.fetch('/leave', {
      method: 'POST',
      body: { bot, collection }
    })
    return res
  }

  async info () {
    const res = await this.fetch('/info')
    return res
  }

  async command (bot, collection, command, args) {
    const path = `/command/${bot}/${collection}`
    const res = await this.fetch(path, {
      method: 'POST',
      body: { command, args }
    })
    return res
  }

  async commandStatus (bot, requestId) {
    const path = `/status/${bot}/${requestId}`
    const res = await this.fetch(path)
    return res
  }

  async getCommands () {
  }

  async _initListener () {
    this._init = true

    const path = this.client.endpoint + '/bot/events'
    const headers = {
      ...this.client.getAuthHeaders(),
      ...this.getHeaders()
    }

    this._eventSource = new EventSource(path, { headers })
    this._eventSource.addEventListener('message', message => {
      try {
        const event = JSON.parse(message.data)
        this._onmessage(event)
      } catch (e) {}
    })
    this._eventSource.addEventListener('error', err => {
      // TODO: Where do these errors go?
      // TODO: After a couple of fails die.
      console.error('Event source error', err)
    })
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
    try {
      const { bot: name, op, data, requestId } = message
      const bot = this.bots.get(name)
      if (!bot) throw new Error('Unknown bot: ' + bot)

      try {
        if (op === 'join') {
          const collection = await this.client.openCollection(data.collection)
          await bot.onjoin(collection, data.config)
          await this.reply({ requestId })
        } else if (op === 'leave') {
          const collection = await this.client.openCollection(data.collection)
          await bot.onleave(collection)
          await this.reply({ requestId })
        } else if (op === 'command') {
          const collection = await this.client.openCollection(data.collection)
          const result = await bot.oncommand(collection, data.command, data.args)
          await this.reply({ requestId, result })
        }
      } catch (err) {
        console.error('bot produced error', err)
        await this.reply({
          requestId: requestId,
          error: err.message
        })
      }
    } catch (err) {
      // TODO: Where to these errors go?
      console.error('Bot stream error', err)
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
    return this.client.fetch(url, opts)
  }

  async register (name, spec, handlers) {
    if (typeof spec !== 'object') throw new Error('Spec must be an object')
    spec.name = name
    const { config, sessionId } = await this.fetch('/announce', {
      method: 'POST',
      body: spec
    })
    this._sessionId = sessionId
    if (!this._init) await this._initListener()
    this.bots.set(name, new Bot({
      spec,
      client: this.client,
      config,
      handlers
    }))
  }

  // async configure (name, config) {
  //   const config = await this.client.fetch('/bot/configure/' + name, config)
  // }
}

class Bot {
  constructor ({ spec, config, handlers, client }) {
    this.spec = spec
    this.name = spec.name
    this.client = client
    this.config = config
    this.handlers = handlers
    this.sessions = new Map()
  }

  async onjoin (collection, config) {
    await this._ensureTypes(collection)
    const session = await this.handlers.onjoin(collection, config)
    if (session.open) {
      await session.open()
    }
    if (session.onrecord) {
      collection.subscribe('bot:' + this.name, session.onrecord.bind(session))
    }
    this.sessions.set(collection, session)
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
    const session = this.sessions.get(collection)
    if (!session) return
    if (session.close) await session.close()
    this.sessions.delete(collection)
  }

  async oncommand (collection, command, args) {
    const session = this.sessions.get(collection)
    if (!session) throw new Error('Bot did not join collection')
    if (!session.oncommand) throw new Error('Bot cannot handle commands')
    return await session.oncommand(command, args)
  }
}

module.exports = Bots
module.exports.Bots = Bots

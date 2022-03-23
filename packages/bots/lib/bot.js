const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise')

class BotSession extends Nanoresource {
  constructor (opts = {}) {
    super()
    this.client = opts.client
    this.spec = opts.spec
    this.log =
      opts.log || this.client.log.child({ name: 'bot:' + this.spec.name })
  }

  async onjoin (collection, config) {
    throw new Error('Not implemented')
  }

  async onleave (collection) {}

  async oncommand (command, args) {
    const method = 'command' + camelize(command)
    if (this[method]) return this[method](args)
    throw new Error(`Command ${command} is not implemented`)
  }
}

class CollectionSession extends Nanoresource {
  constructor (opts = {}) {
    super()
    if (!opts.bot) throw new Error('cannot open session: missing bot option')
    if (!opts.collection)
      throw new Error('cannot open session: missing collection option')
    this.bot = opts.bot
    this.name = opts.bot.spec.name || 'bot'
    this.collection = opts.collection
    this.config = opts.config
    this.log = opts.bot.log.child({ collection: this.collection })
  }

  async oncommand (command, args) {
    this.log.debug('oncommand', command, args)
    const method = 'command' + camelize(command)
    if (this[method]) return this[method](args)
    throw new Error(`Command ${command} is not implemented`)
  }

  // set up subscription with:
  // async onrecord (record)
}

function camelize (str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return word.toUpperCase()
      // return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
}

module.exports = { BotSession, CollectionSession }

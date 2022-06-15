const { createHash } = require('crypto')
const fetch = require('fetch-undici')
const p = require('path')
const { run, readYaml } = require('../run')

module.exports = main
if (require.main === module) {
  run(main)
}

function main (workspace) {
  const name = 'download'

  const spec = readYaml(p.join(__dirname, 'bot.yaml'))

  const handlers = {
    onjoin (collection, config) {
      const session = new DownloadSession({ collection, config })
      return session
    }
  }

  return { name, spec, handlers }
}

class DownloadSession {
  constructor ({ collection, config }) {
    this.collection = collection
    this.config = config
  }

  // Called when the session is opened (= the bot joined a collection)
  async open () {
    console.log(
      'opening session in collection',
      this.collection.name,
      'with config',
      this.config
    )
  }

  // Called when the session is closed (= the bot left a collection)
  async close () {
    console.log('closing session in collection', this.collection.name)
  }

  // If a onrecord method is present, a subscription will be set up automatically
  async onrecord (record) {
    console.log('incoming:', record.lseq, record.id, record.type)
  }

  // Called when the bot receives a command
  async oncommand (command, args) {
    if (command === 'download') return this._ondownload(args)
    if (command === 'hello') return this._onhello(args)
    throw new Error('Invalid command')
  }

  async _onhello (args) {
    if (typeof args === 'string') {
      args = { message: args }
    }
    if (!args || typeof args !== 'object') throw new Error('Invalid args')
    const { message } = args
    if (typeof message !== 'string' || message.lenght < 2) {
      throw new Error('Message too short')
    }
    console.log('handle hello command with message', message)
    const id = await this.collection.put({
      type: 'demobot/message',
      value: {
        message
      }
    })
    console.log('created record', id)
    return id
  }

  async _ondownload (args) {
    console.log(args)
    const [url] = args
    const res = await fetch(url)
    const contentType = res.headers.get('content-type')
    const hash = createHash('sha256')
      .update(url, 'utf8')
      .digest('hex')
    console.log(hash)
    // const filename = url.replace("://", "_").replace(".", "_").replace("/", "_")
    const resourceRecord = {
      filename: hash,
      prefix: 'download'
    }
    const resource = await this.collection.resources.create(resourceRecord)
    await this.collection.resources.writeFile(resource, res, {
      force: true,
      requestType: 'buffer'
    })
  }
}

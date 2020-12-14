const { Client } = require('@arso-project/sonar-client')
const fs = require('fs')
const yaml = require('js-yaml')

module.exports = { run, runSync, readYaml }

function readYaml (path) {
  const buf = fs.readFileSync(path)
  const spec = yaml.safeLoad(buf)
  return spec
}

function runSync (createBot, opts = {}, cb) {
  if (!cb) cb = err => err && console.error(err)
  run(createBot, opts).catch(cb)
}

async function run (createBot, opts) {
  const client = new Client()
  try {
    await client.open()
    const bot = createBot(client)
    const { name, spec, handlers } = bot
    client.log.info('run bot: ' + name)
    await client.bots.register(name, spec, handlers)
    client.log.info('bot registered with server')
  } catch (err) {
    client.log.error({ err })
  }
}

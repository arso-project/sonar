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
  cb = cb || (err => err && console.error(err))
  run.catch(cb)
}

async function run (createBot, opts) {
  const client = new Client()

  const bot = createBot(client)
  const { name, spec, handlers } = bot
  await client.bots.register(name, spec, handlers)

  console.log('bot registered with server')
}

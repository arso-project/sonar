const { Workspace } = require('@arsonar/client')
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
  const workspace = new Workspace()
  try {
    await workspace.open()
    const bot = createBot(workspace)
    const { name, spec, handlers } = bot
    workspace.log.info('run bot: ' + name)
    await workspace.bots.register(name, spec, handlers)
    workspace.log.info('bot registered with server')
  } catch (err) {
    workspace.log.error({ err })
  }
}

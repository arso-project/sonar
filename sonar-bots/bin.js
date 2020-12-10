const p = require('path')
const yargs = require('yargs')
const yaml = require('js-yaml')
const table = require('text-table')
const { Client } = require('@arso-project/sonar-client/node')
const { readYaml } = require('./run')

function createClient (opts) {
  const client = new Client(opts)
  return client
}

const command = {
  command: 'bot',
  describe: 'bot',
  handler: () => yargs.showHelp(),
  builder: yargs => {
    yargs
      .demandCommand(1, '"sonar ui help" lists commands')
      .command({
        command: 'list',
        describe: 'Show connected bots',
        handler: list
      })
      .command({
        command: 'join <bot>',
        describe: 'Join bot to collection',
        handler: join
      })
      .command({
        command: 'cmd <bot> <command> [args]',
        describe: 'Run command',
        handler: runCommand
      })
      .command({
        command: 'status [bot] [requestId]',
        describe: 'Show status',
        handler: commandStatus
      })
      .command({
        command: 'serialize-spec [bot]',
        describe: 'Serialize bot spec to yaml',
        handler: serializeSpec
      })
      .command({
        command: 'runtime',
        describe: 'Start a bot runtime',
        handler: runtimeStart
      })
  }
}

if (require.main === module) {
  command.builder(yargs)
  yargs.demandCommand().help().parse()
} else {
  module.exports = command
}

async function list (argv) {
  const client = createClient(argv)
  const info = await client.bots.info()
  const bots = Object.entries(info)
  if (!bots.length) return console.log('No bots connected')
  console.log('Running bots')
  console.log('------------')
  for (const [name, spec] of bots) {
    console.log(name)
    console.log()
    console.log('  commands:')
    const spacer = '  '
    const commands = spec.commands.map(command => {
      const args = command.args.length
        ? command.args.map(arg => `<${arg.name}>`).join(' ')
        : ''
      return [spacer, command.name, args, command.help || '']
    })
    console.log(table(commands))
    console.log('')
  }
}

async function join (argv) {
  const client = createClient(argv)
  await client.bots.join(argv.bot, argv.collection)
  console.log('ok')
}

async function runCommand (argv) {
  const client = createClient(argv)
  let { bot, collection, command, args, workspace } = argv
  try {
    args = JSON.parse(args)
  } catch (err) {}

  const env = {}
  if (!workspace && collection) env.collection = collection
  else if (!workspace) throw new Error('Either --workspace for workspace scope or a --collection is required')

  // const res = await client.bots.command(bot, collection, command, args)
  const res = await client.bots.command(bot, command, args, env)
  const { requestId, result, error } = res
  console.log('request id: ' + requestId)
  if (res.error) {
    console.log('Command failed with error: ' + error)
  } else {
    console.log(result)
  }
}

async function commandStatus (argv) {
  const client = createClient(argv)
  const { bot, requestId } = argv
  if (requestId) {
    const res = await client.bots.commandStatus(bot, requestId)
    console.log(res)
  } else {
    const res = await client.bots.status()
    console.log(res)
  }
}

async function serializeSpec (argv) {
  const client = createClient(argv)
  const { bot } = argv
  const info = await client.bots.info()
  if (!info[bot]) throw new Error('Bot not found')
  // const toml = TOML.stringify(info[bot])
  const encoded = yaml.safeDump(info[bot])
  console.log(encoded)
}

async function runtimeStart (argv) {
  console.log('ok')
  // start runtime
  const Runtime = require('./lib/runtime')
  const runtime = new Runtime()
  await runtime.open()
  console.log('runtime started')

  // register bot
  const client = createClient(argv)
  const spec = {
    name: 'Runtime',
    commands: [
      {
        name: 'start',
        args: [
          { name: 'bot', type: 'string', title: 'Bot to run' }
        ]
      },
      {
        name: 'status',
        args: []
        // response: {
        //   type: 'object
        // }
      }
    ]
  }
  const handlers = { oncommand }
  await client.bots.register('runtime', spec, handlers)
  console.log('connected to server')

  // run forever
  await new Promise((resolve, reject) => {
    runtime.once('err', reject)
    runtime.once('close', resolve)
  })

  async function oncommand (command, args) {
    if (command === 'start') return start(args)
    if (command === 'status') return status(args)
    throw new Error('command not found')
  }

  async function start (args) {
    if (typeof args === 'string') args = { bot: args }
    const { bot: botName } = args
    try {
      const { spec, entry, path } = resolveBot(botName)
      // TODO: Validate against whitelist
      const service = await runtime.startBot(spec.name, entry)
      const logs = service.createLogStream()
      logs.on('data', data => console.log('LOG', botName, data.toString()))
      return true
    } catch (err) {
      console.error('bot start error', err)
      return false
    }
  }

  async function status () {
    return runtime.status()
  }
}

function resolveBot (botName) {
  const packagePath = require.resolve(p.join(botName, 'package.json'))
  const path = p.dirname(packagePath)
  const spec = readYaml(p.join(path, 'bot.yaml'))
  const packageJson = require(packagePath)
  const entryModule = spec.entry || packageJson.main
  const entry = p.join(path, entryModule)
  return { spec, entry, path }
}

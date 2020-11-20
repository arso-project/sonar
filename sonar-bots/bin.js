const yargs = require('yargs')
const yaml = require('js-yaml')
const table = require('text-table')
const { Client } = require('@arso-project/sonar-client/node')

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
        describe: 'Serialize bot spec to toml',
        handler: serializeSpec
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
    console.log('  Available commands:')
    const spacer = '  '
    const commands = spec.commands.map(command => {
      const args = command.args.map(arg => `<${arg.name}>`).join(' ')
      return [spacer, command.name, args, command.help]
    })
    console.log(table(commands))
  }
}

async function join (argv) {
  const client = createClient(argv)
  await client.bots.join(argv.bot, argv.collection)
  console.log('ok')
}

async function runCommand (argv) {
  const client = createClient(argv)
  let { bot, collection, command, args } = argv
  try {
    args = JSON.parse(args)
  } catch (err) {}
  const res = await client.bots.command(bot, collection, command, args)
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


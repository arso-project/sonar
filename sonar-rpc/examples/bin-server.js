const p = require('path')
const os = require('os')
const fs = require('fs').promises
const repl = require('repl')
const { Server, Client } = require('./index.js')
const minimist = require('minimist')

const SONAR_STORAGE_DIR = p.join(os.homedir(), '.sonar', 'storage')

const Collections = require('./collections')

const argv = minimist(process.argv.slice(2), {
  boolean: ['repl', 'help'],
  default: {
  },
  alias: {
    repl: 'r',
    help: 'h'
  }
})

const version = `hyperspace/${require('../package.json').version} ${process.platform}-${process.arch} node-${process.version}`

const help = `SONAR demo
${version}

Usage: sonar [options]

  --repl      -r   Run a debug repl
  --help      -h   Show this help text
`

if (argv.help) {
  console.error(help)
  process.exit(0)
}

main().catch(onerror)

async function main () {
  console.log('Running ' + version)

  const collections = new Collections()

  const s = new Server({
    collections
  })
  global.sonar = s

  if (!argv.repl) {
    s.on('client-open', () => {
      console.log('Remote client opened')
    })

    s.on('client-close', () => {
      console.log('Remote client closed')
    })
  } else {
    const r = repl.start({
      useGlobal: true
    })
    r.context.server = s
  }

  process.once('SIGINT', close)
  process.once('SIGTERM', close)

  try {
    await s.open()
  } catch (err) {
    throw err
    // const c = new Client()
    // let status

    // try {
    //   status = await c.status()
    // } catch (_) {}

    // if (status) {
    //   console.log('Server is already running with the following status')
    //   console.log()
    //   console.log('API Version   : ' + status.apiVersion)
    //   console.log('Holepunchable : ' + status.holepunchable)
    //   console.log('Remote address: ' + status.remoteAddress)
    //   console.log()
    //   process.exit(1)
    // } else {
    //   throw err
    // }
  }

  const socketOpts = s._socketOpts
  if (socketOpts.port) {
    console.log(`Listening on ${socketOpts.host || 'localhost'}:${socketOpts.port}`)
  } else {
    console.log(`Listening on ${socketOpts}`)
  }

  function close () {
    console.log('Shutting down...')
    s.close().catch(onerror)
  }
}

// async function getStoragePath () {
//   try {
//     // If this dir exists, use it.
//     await fs.stat(HYPERDRIVE_STORAGE_DIR)
//     return HYPERDRIVE_STORAGE_DIR
//   } catch (err) {
//     if (err.code !== 'ENOENT') throw err
//     return HYPERSPACE_STORAGE_DIR
//   }
// }

function onerror (err) {
  console.error(err.stack)
  process.exit(1)
}

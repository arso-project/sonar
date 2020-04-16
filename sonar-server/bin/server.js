const debug = require('debug')('sonar-server')
const p = require('path')
const { fork, spawn } = require('child_process')
const onexit = require('async-exit-hook')
const { printLogo } = require('@arso-project/sonar-cli/util/logo.js')
const options = require('./lib/options')

const DEV_DEBUG = '*,-express*,-hypercore-protocol*,-bodyparser*'

exports.command = 'server <command>'
exports.describe = 'server'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'start',
      describe: 'start the sonar server',
      handler: startServer,
      builder: options
    })
    .command({
      command: 'stop',
      describe: 'stop server',
      handler: stop
    })
}
exports.startServer = startServer
exports.options = options

function startServer (argv) {
  printLogo()

  if (argv.dev) {
    debug('starting server in developer\'s mode')
    process.env.DEBUG = process.env.DEBUG || DEV_DEBUG
    process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  }

  const path = p.join(__dirname, '..', 'launch.js')
  const args = [path, ...copyArgs(argv, ['port', 'hostname', 'storage', 'dev'])]

  const nodeExe = process.execPath

  const proc = spawn(nodeExe, args, {
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR || '2'
    },
    stdio: 'inherit'
  })

  let closing = false
  proc.on('exit', code => {
    if (closing) return
    process.exit(code)
  })

  onexit(cb => {
    closing = true
    if (proc.killed || proc.exitCode !== null) return cb()
    proc.once('exit', cb)
    proc.kill()
  })
}

function stop (args) {
  console.error('not implemented')
}

function copyArgs (from, keys) {
  const args = []
  for (const key of keys) {
    if (from[key] !== undefined) {
      args.push(argkey(key))
      if (from[key] !== true) {
        args.push(from[key])
      }
    }
  }
  return args
  function argkey (key) {
    return '--' + key.replace(
      /[\w]([A-Z])/g,
      m => m[0] + '-' + m[1]
    ).toLowerCase()
  }
}

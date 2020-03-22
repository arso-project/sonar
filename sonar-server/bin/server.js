// const SonarServer = require('../server.js')
const p = require('path')
const { spawn } = require('child_process')
const onexit = require('async-exit-hook')
const { printLogo } = require('@arso-project/sonar-cli/util/logo.js')
const options = require('./lib/options')

exports.command = 'server <command>'
exports.describe = 'server'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'start',
      describe: 'start the sonar server',
      handler: start,
      builder: options
    })
    .command({
      command: 'stop',
      describe: 'stop server',
      handler: stop
    })
}
exports.startServer = start
exports.options = options

function start (argv) {
  printLogo()

  const path = p.join(__dirname, '..', 'launch.js')
  const args = [path]
  if (argv.port) args.push('--port', argv.port)
  if (argv.hostname) args.push('--hostname', argv.hostname)
  if (argv.storage) args.push('--storage', argv.storage)

  const proc = spawn('node', args, {
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR || '2'
    },
    stdio: 'inherit'
  })

  onexit(cb => {
    console.log(proc)
    if (proc.killed) return cb()
    proc.once('exit', cb)
    proc.kill()
  })
}

function stop (args) {
  console.error('not implemented')
}

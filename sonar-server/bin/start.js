const p = require('path')
const { spawn } = require('child_process')
const debug = require('debug')
const onexit = require('async-exit-hook')

const { options, startServer } = require('./server')

exports.command = 'start'
exports.describe = 'start sonar'
exports.handler = start
exports.builder = {
  ...options,
  dev: {
    alias: 'd',
    describe: 'Start in developer mode'
  }
}

function start (argv) {
  if (argv.dev) {
    process.env.DEBUG = process.env.DEBUG || 'sonar:*'
  }
  startServer(argv)
  const path = p.join(__dirname, '..', 'bin.js')
  const cmd = argv.dev ? 'dev' : 'serve'
  const proc = spawn('node', [path, 'ui', cmd], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DEBUG: '',
      FORCE_COLOR: process.env.FORCE_COLOR || '2'
    }
  })
  onexit(cb => {
    if (proc.killed) return cb()
    proc.once('exit', cb)
    proc.kill()
  })
}

// function stop (args) {
//   console.error('not implemented')
// }

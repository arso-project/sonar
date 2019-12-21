const p = require('path')
const { spawn } = require('child_process')
const debug = require('debug')

const { startServer } = require('./server-start')

exports.command = 'start'
exports.describe = 'start sonar'
exports.handler = start
exports.builder = {
  port: {
    alias: 'p',
    describe: 'port',
    default: 9191
  },
  hostname: {
    alias: 'h',
    describe: 'hostname',
    default: 'localhost'
  },
  storage: {
    alias: 's',
    describe: 'The storage path for this sonar server'
  },
  dev: {
    alias: 'd',
    describe: 'Start in developer mode'
  }
}

function start (argv) {
  if (argv.dev) {
    // TODO: Why does this not work?
    debug.enable('sonar')
  }
  startServer(argv)
  const path = p.join(__dirname, '..', 'bin.js')
  const cmd = argv.dev ? 'dev' : 'serve'
  spawn('node', [path, 'ui', cmd], {
    env: {
      ...process.env,
      DEBUG: '',
      FORCE_COLOR: 2
    },
    stdio: 'inherit'
  })
}

function stop (args) {
  console.error('not implemented')
}

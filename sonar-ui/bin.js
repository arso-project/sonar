#!/usr/bin/env node

const { spawn } = require('child_process')
const express = require('express')
const p = require('path')
const fs = require('fs')
const open = require('open')
const yargs = require('yargs')

// TODO: This pulls webpack-nano into packaging.
// Should be optional.
const WP_BIN = process.env.WP_BIN || require.resolve('webpack-nano/bin/wp.js')
const DIST_PATH = p.join('build', 'dist')

const commonOptions = {
  workdir: {
    alias: 'd',
    describe: 'workdir where source files are',
    default: process.env.WORKDIR || __dirname
  }
}
const serveOptions = {
  port: {
    alias: 'p',
    describe: 'port to listen on for HTTP request',
    default: process.env.PORT || 55555
  },
  hostname: {
    alias: 'h',
    describe: 'hostname to listen on for HTTP request',
    default: process.env.HOSTNAME || 'localhost'
  },
  open: {
    alias: 'o',
    type: 'boolean',
    describe: 'open UI in browser'
  }
}

const command = {
  command: 'ui',
  describe: 'ui',
  handler: () => yargs.showHelp(),
  builder: yargs => {
    yargs
      .demandCommand(1, '"sonar ui help" lists commands')
      .command({
        command: 'dev',
        describe: 'Start Sonar UI in dev mode (rebuilds on changes)',
        handler: dev,
        builder: { ...commonOptions, ...serveOptions }
      })
      .command({
        command: 'build',
        describe: 'Build the ui',
        handler: build,
        builder: {
          ...commonOptions,
          static: {
            boolean: true,
            describe: 'Build a static HTML export'
          }
        }
      })
      .command({
        command: ['start', 'serve'],
        describe: 'Serve Sonar UI over HTTP',
        builder: { ...commonOptions, ...serveOptions },
        handler: serve
      })
  }
}

if (require.main === module) {
  command.builder(yargs)
  yargs.demandCommand().help().parse()
} else {
  module.exports = command
  module.exports.serve = serve
}

function createServer (opts) {
  const app = express()
  const { port, hostname } = opts
  app.start = function () {
    app.listen(port, hostname, (err) => {
      if (err) return console.error(err)
      const link = `http://${hostname}:${port}`
      console.log(`UI ready on ${link}`)
      if (opts.open) open(link)
    })
  }
  return app
}

function dev (argv) {
  console.log('Starting UI in dev mode')
  argv.workdir = p.resolve(argv.workdir)
  const configPath = findWebpackConfig(argv.workdir)
  console.log('Webpack config: ' + configPath)

  process.env.NODE_ENV = 'development'
  process.env.WORKDIR = argv.workdir

  const app = createServer(argv)

  const config = require(configPath)
  const webpack = require('webpack')

  // Enable hot module replacement.
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
  config.entry.unshift(require.resolve('webpack-hot-middleware/client'))

  const compiler = webpack(config)
  app.use(
    require('webpack-dev-middleware')(compiler, {
      publicPath: config.output.publicPath,
      stats: 'minimal'
      // TODO: Somehow the 'preset' setting isn't working
      // stats: {
      //   preset: 'minimal',
      //   moduleTrace: true,
      //   errorDetails: true
      // }
    })
  )
  app.use(
    require('webpack-hot-middleware')(compiler, {
      log: false,
      path: '/__webpack_hmr',
      heartbeat: 10 * 1000
    })
  )

  app.start()
}

function serve (argv) {
  const app = createServer(argv)
  const staticPath = p.join(p.resolve(argv.workdir), DIST_PATH)
  app.use(express.static(staticPath))
  app.start()
}

function build (argv) {
  console.log('Start building UI')
  argv.workdir = p.resolve(argv.workdir)
  const configPath = findWebpackConfig(argv.workdir)
  console.log('Webpack config: ' + configPath)

  process.env.NODE_ENV = 'production'
  process.env.WORKDIR = argv.workdir

  const args = copyArgs(argv, ['static', 'watch', 'port', 'hostname', 'workdir'])
  spawn('node', [WP_BIN, '--config', configPath, ...args], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  })
}

function findWebpackConfig (workdir) {
  if (fs.existsSync(p.join(workdir, 'webpack.config.js'))) {
    return p.join(workdir, 'webpack.config.js')
  } else {
    return p.join(__dirname, 'webpack.config.js')
  }
}

function copyArgs (from, keys) {
  const args = []
  for (const key in keys) {
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

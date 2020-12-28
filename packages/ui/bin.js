#!/usr/bin/env node

const express = require('express')
const p = require('path')
const fs = require('fs')
const open = require('open')
const yargs = require('yargs')

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
          },
          analyze: {
            boolean: true,
            describe: 'Analyze build size'
          },
          'json-stats': {
            boolean: true,
            describe: 'Emit build stats as JSON'
          },
          bench: {
            boolean: true,
            describe: 'Benchmark build timings'
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

  process.env.NODE_ENV = 'development'
  process.env.WORKDIR = argv.workdir

  const config = getWebpackConfig(argv)
  const webpack = require('webpack')

  const app = createServer(argv)

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
  console.error('Start building UI')
  process.env.NODE_ENV = process.env.NODE_ENV || 'production'
  process.env.WORKDIR = argv.workdir

  const webpack = require('webpack')
  const config = getWebpackConfig(argv)

  if (argv.jsonStats) {
    config.profile = true
    config.stats = 'verbose'
  }

  const compiler = webpack(config)
  if (argv.watch) {
    console.error('Watching files and rebuilding on changes')
    compiler.watch({}, done)
  } else {
    compiler.run(done)
  }

  function done (err, stats) {
    if (err) console.log('Build errored', err)
    if (argv.jsonStats) {
      console.log(JSON.stringify(stats.toJson(), 0, 2))
    } else {
      console.log(stats.toString({
        colors: true,
        assets: false,
        buildAt: true,
        cached: true,
        chunks: false,
        context: argv.workdir,
        entrypoints: true,
        errors: true,
        errorDetails: true,
        hash: false,
        modules: false,
        timings: true,
        warnings: false,
        version: !argv.watch,
        performance: false,
        providedExports: false,
        children: false
      }))
    }
  }
}

function getWebpackConfig (argv) {
  const configPath = findWebpackConfig(argv.workdir)
  console.error('Webpack config: ' + configPath)
  let config = require(configPath)
  if (config.createConfig) {
    config = config.createConfig(argv)
  }
  return config
}

function findWebpackConfig (workdir) {
  workdir = p.resolve(workdir)
  if (fs.existsSync(p.join(workdir, 'webpack.config.js'))) {
    return p.join(workdir, 'webpack.config.js')
  } else {
    return p.join(__dirname, 'webpack.config.js')
  }
}

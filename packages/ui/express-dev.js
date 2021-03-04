const p = require('path')
const fs = require('fs')
const debug = require('debug')('sonar:ui')

const DEFAULT_PUBLIC_PATH = '/ui-dev'

module.exports = function addDevServer (app, opts = {}) {
  if (process.env.DEBUG && process.env.DEBUG.search('babel') === -1) {
    process.env.DEBUG += ',-babel*'
  }
  opts = {
    ...opts,
    publicPath: opts.publicPath || DEFAULT_PUBLIC_PATH,
    workdir: opts.workdir || process.env.WORKDIR || __dirname
  }

  const config = getWebpackConfig(opts)
  const webpack = require('webpack')

  // Enable hot module replacement.
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
  config.entry.unshift(require.resolve('webpack-hot-middleware/client'))
  config.output.publicPath = opts.publicPath

  debug('mounting ui dev server on ' + opts.publicPath)
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
}

function getWebpackConfig (argv) {
  const configPath = findWebpackConfig(argv.workdir)
  debug('starting ui dev server with webpack config: ' + configPath)
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

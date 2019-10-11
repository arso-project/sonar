const argv = require('webpack-nano/argv')
const p = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { WebpackPluginServe } = require('webpack-plugin-serve')

const isDev = argv.watch || argv.serve || process.env.NODE_ENV === 'development'

const config = {
  entry: ['./src/index.js'],
  mode: isDev ? 'development' : 'production',
  watch: argv.watch || argv.serve,
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          'babel-loader'
        ]
      }
    ]
  },
  output: {
    path: p.join(__dirname, 'build'),
    publicPath: '/',
    filename: 'bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      // template: './index.html'
    })
  ]
}

if (argv.serve) {
  config.plugins.push(
    new WebpackPluginServe({
      host: 'localhost',
      static: ['./build'],
      open: true,
      liveReload: true
    })
  )
  config.entry.push(
    'webpack-plugin-serve/client'
  )
}

module.exports = config

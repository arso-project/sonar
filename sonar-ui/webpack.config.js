const argv = require('webpack-nano/argv')
const p = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { WebpackPluginServe } = require('webpack-plugin-serve')

const isDev = argv.watch || argv.serve || process.env.NODE_ENV === 'development'
const output = isDev ? p.join(__dirname, 'build') : p.join(__dirname, 'dist')

const config = {
  entry: ['./src/index.js'],
  mode: isDev ? 'development' : 'production',
  watch: argv.watch || argv.serve,
  devtool: isDev ? 'eval-source-map' : 'none',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          'babel-loader'
        ]
      },
      {
        test: /\.(css|pcss)$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          'postcss-loader'
        ]
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/'
            }
          }
        ]
      }
    ]
  },
  output: {
    path: output,
    publicPath: '/',
    filename: 'bundle.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Sonar'
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

const argv = require('webpack-nano/argv')
const p = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { WebpackPluginServe } = require('webpack-plugin-serve')
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin')

const isDev = argv.watch || argv.serve || process.env.NODE_ENV === 'development'
let output = 'dist'
let ramdisk = false
if (isDev) {
  // Optional ramdisk arg to build in a ramdisk (faster!)
  ramdisk = !!argv.ramdisk || !!process.env.WP_RAM
  output = ramdisk ? 'build-ramdisk' : 'build'
}
output = p.join(__dirname, output)

let config = {
  entry: ['./src/index.js'],
  mode: isDev ? 'development' : 'production',
  watch: argv.watch || argv.serve,
  devtool: isDev ? 'eval-source-map' : 'none',
  stats: 'minimal',
  module: {
    rules: [
      // Transpile JS and JSX with babel
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              // plugins: [isDev && require.resolve('react-refresh/babel')].filter(Boolean)
            }
          }
        ]
      }
      // Support importing CSS files and process them with PostCSS
      // {
      //   test: /\.(css|pcss)$/,
      //   use: [
      //     'style-loader',
      //     { loader: 'css-loader', options: { importLoaders: 1 } },
      //     'postcss-loader'
      //   ]
      // },
      // Support importing font files (also from CSS files)
      // {
      //   test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
      //   use: [
      //     {
      //       loader: 'file-loader',
      //       options: {
      //         name: '[name].[ext]',
      //         outputPath: 'fonts/'
      //       }
      //     }
      //   ]
      // }
    ]
  },
  output: {
    path: output,
    publicPath: '/',
    filename: 'bundle.js'
  },
  plugins: [
    // Create an index.html file
    new HtmlWebpackPlugin({
      title: 'Sonar',
      meta: { viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no' },
      inlineSource: '.(js|css)$' // has only an effect with HtmlWebpackInlineSourcePlugin
      // template: './index.html'
    })
  ]
}

// --static: Include all CSS and JS directly in a singel HTML file
if (argv.static) {
  console.log('Building in static mode')
  config.plugins.push(new HtmlWebpackInlineSourcePlugin())
}

// --analyze: Analyze bundle size
if (argv.analyze || process.env.WEBPACK_ANALYZE) {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
  config.plugins.push(new BundleAnalyzerPlugin())
}

// --serve: Spin up a web server to serve the built UI
if (argv.serve) {
  config.plugins.push(
    new WebpackPluginServe({
      host: 'localhost',
      static: output,
      open: false,
      // liveReload: true,
      hmr: true,
      historyFallback: true,
      // progress: 'minimal',
      progress: false,
      ramdisk: ramdisk
    })
  )
  // config.plugins.push(new ReactRefreshWebpackPlugin())
  config.entry.push(
    'webpack-plugin-serve/client'
  )
}

// --bench: Measure webpack build time
if (argv.bench || process.env.WEBPACK_BENCH) {
  const SpeedMeasurePlugin = require('speed-measure-webpack-plugin')
  const smp = new SpeedMeasurePlugin({
    // granularLoaderData: true
  })
  config = smp.wrap(config)
}

module.exports = config

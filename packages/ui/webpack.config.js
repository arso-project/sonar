const argv = require('yargs-parser')(process.argv)
const fs = require('fs')
const p = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin')
const debug = require('debug')('sonar:ui')

const INDEX_HTML_PATH = 'src/index.html'

const opts = {
  // A workdir is the main entrypoint. Entry file is expected at src/index.js.
  workdir: p.resolve(argv.workdir || process.env.WORKDIR || __dirname),
  // Enable dev mode (source maps, hot reloading)
  dev: process.env.NODE_ENV === 'development',
  // Build in stati mode (single html file)
  static: argv.static || process.env.WEBPACK_STATIC,
  // Analyze bundle size
  analyze: argv.analyze || process.env.WEBPACK_ANALYZE,
  // Benchmark build time
  bench: argv.bench || process.env.WEBPACK_BENCH
}

module.exports = createConfig(opts)

function createConfig (opts) {
  const target = opts.dev ? 'debug' : 'dist'
  const output = p.join(opts.workdir, 'build', target)

  const entry = [
    p.join(opts.workdir, './src/index.js')
  ]

  // Create an index html file.
  const htmlWebpackOpts = {
    title: 'Sonar',
    meta: { viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no' },
    inlineSource: '.(js|css)$' // has only an effect with HtmlWebpackInlineSourcePlugin
  }
  const indexHtmlPath = p.resolve(p.join(opts.workdir, INDEX_HTML_PATH))
  try {
    fs.statSync(indexHtmlPath)
    htmlWebpackOpts.template = indexHtmlPath
  } catch (err) {}
  const htmlWebpackPlugin = new HtmlWebpackPlugin(htmlWebpackOpts)

  let config = {
    entry,
    mode: opts.dev ? 'development' : 'production',
    watch: argv.watch || argv.serve,
    // devtool: 'inline-source-map',
    devtool: opts.dev ? 'eval-cheap-module-source-map' : 'source-map',
    stats: 'minimal',
    devServer: {
      contentBase: output
    },
    module: {
      rules: [
        // Transpile JS and JSX with babel
        {
          test: /\.(js|jsx)$/,
          // Do not transpile node_modules, but do transpile
          // our own modules even if they are behind node_modules.
          exclude: function (modulePath) {
            const exclude = /node_modules/.test(modulePath) &&
                !/node_modules\/@arso-project/.test(modulePath)
            return exclude
          },
          use: [
            {
              loader: require.resolve('babel-loader'),
              options: {
                // This is our base .babelrc. Using a config file allows us
                // to reuse it in different workdirs.
                configFile: p.join(__dirname, 'babel.config.json'),
                // Search for babelrc in the workdir, and allow here too.
                babelrcRoots: [
                  __dirname,
                  opts.workdir
                ],
                // Include react-hot-loader in dev mode.
                plugins: opts.dev ? [require.resolve('react-hot-loader/babel')] : undefined
              }
            }
          ]
        }
      ]
    },
    resolve: {
      // Do not resolve symlinks. Otherwise, yarn link does not work properly.
      symlinks: false
    },
    output: {
      path: output,
      publicPath: '/',
      filename: 'bundle.js',
      pathinfo: false
    },
    plugins: [
      // Create an index.html file
      htmlWebpackPlugin
    ]
  }

  // --static: Include all CSS and JS directly in a singel HTML file
  if (opts.static) {
    console.log('Building in static mode')
    config.plugins.push(new HtmlWebpackInlineSourcePlugin())
  }

  // --analyze: Analyze bundle size
  if (opts.analyze) {
    console.log('Analyzing build size')
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    config.plugins.push(new BundleAnalyzerPlugin())
  }

  // Include react-hot-loader patch in dev mode
  if (opts.dev) {
    config.entry.unshift(require.resolve('react-hot-loader/patch'))
  }

  // --bench: Measure webpack build time
  if (opts.bench) {
    console.log('Benchmarking build time')
    const SpeedMeasurePlugin = require('speed-measure-webpack-plugin')
    const smp = new SpeedMeasurePlugin({
      // granularLoaderData: true
    })
    config = smp.wrap(config)
  }

  return config
}

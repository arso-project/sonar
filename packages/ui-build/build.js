#!/usr/bin/env node

const p = require('path')
const pretty = require('pretty-bytes')
const mirror = require('mirror-folder')
const fs = require('fs')
const { build: estrellaBuild, cliopts, log } = require('estrella')
const sassPlugin = require('esbuild-plugin-sass')

if (require.main === module) {
  build()
} else {
  module.exports = { ...require('estrella'), build }
}

function build (opts) {
  const [parsedOpts, parsedArgs] = cliopts.parse(
    [['b', 'base'], 'Basedir for entry and outdir', '<path>'],
    [['e', 'entry'], 'Entry file'],
    [['o', 'outfile'], 'Path to write output bundle to (default: build/bundle.js)', '<path>'],
    [['no-serve'], 'Don\'t start a development server in watch mode'],
    [['a', 'assets'], 'Path to static assets to copy to build folder', '<path>'],
    [['c', 'copy'], 'Copy static assets into outdir'],
    [['m', 'minify'], 'Minify javascript'],
    ['host', 'Development server: Hostname', '<host>'],
    ['port', 'Development server: Port', '<port>']
  )
  opts = {
    ...cliopts,
    ...opts,
    ...parsedOpts
  }
  if (!opts.base) opts.base = process.cwd()
  opts.base = p.resolve(opts.base)
  if (!opts.entry) opts.entry = parsedArgs[0] || findMain(opts.base)
  if (!opts.outfile) opts.outfile = p.join(opts.base, 'build/bundle.js')
  const base = opts.base || process.cwd()
  const outdir = p.dirname(opts.outfile)
  try {
    fs.mkdirSync(outdir, { recursive: true })
  } catch (err) {}
  if (opts.serve) cliopts.watch = true
  if (opts.copy && !opts.assets) {
    opts.assets = findAssets(base)
  }
  if (opts.assets) {
    const src = opts.assets
    const dst = p.join(outdir, p.basename(src))
    mirrorAssets(src, dst, { watch: opts.watch, base: base, verbose: true })
  }
  if (opts.minify === undefined) {
    opts.minify = !cliopts.watch
  }

  const estrellaOpts = {
    entry: opts.entry,
    outfile: opts.outfile,
    // external: ['http', 'https'],
    bundle: true,
    sourcemap: true,
    minify: opts.minify,
    loader: {
      // '.js': 'jsx',
      '.woff': 'file',
      '.woff2': 'file'
    },
    // This banner fixes some modules that were designed for Node.js
    // to run in the browser by providing minimal shims.
    banner: {
      js: `
        var global = window;
        window.process = {
          title: "browser",
          env: {},
          nextTick: function (cb, ...args) {
            Promise.resolve().then(() => cb(...args))
          }
        };
      `
    },
    define: {
      'process.title': JSON.stringify('browser'),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    plugins: [sassPlugin()],
    onEnd
  }

  if (opts.jsx) {
    estrellaOpts.loader['.js'] = 'jsx'
    estrellaOpts.loader['.ts'] = 'tsx'
  }

  estrellaBuild(estrellaOpts)

  // Run a local web server with livereload when -watch is set
  if (opts.watch && !opts['no-serve']) {
    const instant = require('instant')
    const express = require('express')
    const port = opts.port || 3000
    const host = opts.host || 'localhost'
    const app = express()
    app.use(instant({ root: opts.base }))
    app.listen(port, host, () => {
      log.info(`Development server listening on http://${host}:${port}`)
    })
  }

  function onEnd () {}
}

function findMain (base) {
  const candidates = ['main', 'index']
  const dirs = [base, p.join(base, 'src')]
  const endings = ['js', 'jsx', 'ts', 'tsx']
  for (const c of candidates) {
    for (const d of dirs) {
      for (const e of endings) {
        const path = `${d}/${c}.${e}`
        if (fs.existsSync(path)) return path
      }
    }
  }
  return null
}

function findAssets (base) {
  const candidates = ['assets', 'static']
  for (const c of candidates) {
    const path = p.join(base, c)
    if (fs.existsSync(path)) return path
  }
}

function mirrorAssets (src, dst, { watch, verbose, base } = {}) {
  if (src === dst) return
  const rel = path => p.relative(base, path)
  const progress = mirror(src, dst, { watch }, err => {
    if (!err) return
    log.error('Error when copying assets:' + err.message)
    process.exit(1)
  })
  progress.on('error', err => {
    log.error('Error when copying assets:' + err.message)
    process.exit(1)
  })
  if (verbose) {
    progress.on('put', (src, dst) => {
      // console.log({ src, dst })
      log.error(`Copy: ${rel(src.name)} -> ${rel(dst.name)} (${pretty(src.stat.size)})`)
    })
  }
}

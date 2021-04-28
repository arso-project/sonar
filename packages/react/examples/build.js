#!/usr/bin/env node
const p = require('path')
const { build, cliopts } = require('estrella')

const [ opts, args ] = cliopts.parse(
  ['host', 'Development server: Hostname', '<host>'],
  ['port', 'Development server: Port']
)

const base = process.cwd()
const entry = p.join(base, 'main.js')
const outfile = p.join(base, 'build/bundle.js')
let devServerMessage
let firstRun = true

build({
  entry,
  outfile,
  // external: ['http', 'https'],
  bundle: true,
  sourcemap: true,
  minify: false,
  loader: {
    '.js': 'jsx',
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
    'process.title': '"browser"',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  onEnd
})

// Run a local web server with livereload when -watch is set
if (cliopts.watch) {
  const instant = require('instant')
  const express = require('express')
  const port = cliopts.port || 3000
  const host = opts.host || 'localhost'
  const app = express()
  app.use(instant({ root: __dirname }))
  app.listen(port, host, () => {
    devServerMessage = `Listening on http://${host}:${port} and watching for changes ...`
    console.log(devServerMessage)
  })
  // const browserSync = require('browser-sync')
  // browserSync({
  //   server: __dirname,
  //   files: ['build/*'],
  //   ghostMode: false,
  //   open: false
  // })
}

function onEnd () {
  if (!firstRun) return
  firstRun = false
  if (devServerMessage) console.log(devServerMessage)
}

#!/usr/bin/env node

const { spawn } = require('child_process')
const cli = require('@arso-project/sonar-cli')
const express = require('express')
const p = require('path')
const open = require('open')

// TODO: This pulls webpack-nano into packaging.
// Should be optional.
const WP_BIN = require.resolve('webpack-nano/bin/wp.js')
const WP_CONFIG = p.join(__dirname, 'webpack.config.js')

const command = {
  command: 'ui [dev|serve]',
  describe: 'ui',
  builder: yargs => {
    yargs
      .demandCommand(1, '"sonar ui help" lists commands')
      .command({
        command: 'dev',
        describe: 'Start Sonar UI in dev mode (rebuilds on changes)',
        handler: dev
      })
      .command({
        command: 'build',
        describe: 'Build the ui',
        handler: build,
        builder: {
          static: {
            boolean: true,
            describe: 'Build a static HTML export'
          }
        }
      })
      .command({
        command: ['start', 'serve'],
        describe: 'Serve Sonar UI over HTTP',
        builder: {
          port: {
            alias: 'p',
            describe: 'port to listen on for HTTP request',
            default: 55555
          },
          hostname: {
            alias: 'h',
            describe: 'hostname to listen on for HTTP request',
            default: 'localhost'
          },
          open: {
            alias: 'o',
            type: 'boolean',
            describe: 'open UI in browser'
          }
          // 'insecure-api-proxy': {
          //   type: 'boolean',
          //   describe: 'serve a proxy to the sonar api'
          // }
        },
        handler: serve
      })
  }
}

const args = cli.command(command)
if (require.main === module) args.demandCommand().parse()
else module.exports = args

function dev (argv) {
  console.log('Starting UI in dev mode')
  console.log('Webpack config: ' + WP_CONFIG)
  const cmd = spawn('node', [WP_BIN, '--config', WP_CONFIG, '--serve'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  })
  // cmd.stdout.pipe(process.stdout)
  // cmd.stderr.pipe(process.stderr)
}

function build (argv) {
  console.log('Building UI')
  console.log('Webpack config: ' + WP_CONFIG)
  const args = []
  if (argv.static) args.push('--static')
  const cmd = spawn('node', [WP_BIN, '--config', WP_CONFIG, args], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  })
  // cmd.stdout.pipe(process.stdout)
  // cmd.stderr.pipe(process.stderr)
}

function serve (argv) {
  const app = express()
  const path = p.join(__dirname, 'dist')
  app.use(express.static(path))

  const { port, hostname } = argv
  app.listen(port, hostname, (err) => {
    if (err) return console.error(err)
    const link = `http://${hostname}:${port}`
    console.log(`UI ready on ${link}`)
    if (argv.open) open(link)
  })

  // const httpProxy = require('http-proxy')
  // const crypto = require('crypto')
  // const TOKEN_HEADER = 'x-sonar-access-token'
  // const token = crypto.randomBytes(16).toString('hex')
  // const endpoint = argv.endpoint || 'http://localhost:9191/api'
  // if (argv.insecureApiProxy) {
  //   // To be able to actually serve a useful remote UI a proxy
  //   // onto the API server is created.
  //   // TODO: Rethink this of course!
  //   // Likely it should work the other way round:
  //   // - The server opens a proxy for the API (or just serves it)
  //   // - The token is checked there
  //   // And then use proper ephemeral tokens or hashes.
  //   const proxy = httpProxy.createServer()
  //   app.use('/api', (req, res, next) => {
  //     // A very (too) simple auth scheme: if you have the single
  //     // token per running session, you're good. otherwise not.
  //     // The UI can remember the token for you.
  //     if (req.headers[TOKEN_HEADER] !== token) {
  //       return res.status(401).send({ error: 'invalid access token' })
  //     }
  //     proxy.web(req, res, { target: endpoint })
  //   })
  //   console.log(`Link with API access:\n${link}/#/token/${token}`)
  // }
}

#!/usr/bin/env node

const { exec } = require('child_process')
const cli = require('@arso-project/sonar-cli')
const express = require('express')
const httpProxy = require('http-proxy')
const p = require('path')
const open = require('open')
const crypto = require('crypto')

const command = {
  command: 'ui [dev|serve]',
  describe: 'ui',
  builder: yargs => {
    yargs
      .command({
        command: 'dev',
        describe: 'start sonar ui (dev mode)',
        handler: dev
      })
      .command({
        command: 'serve',
        describe: 'start sonar ui (dev mode)',
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
          },
          'insecure-api-proxy': {
            type: 'boolean',
            describe: 'serve a proxy to the sonar api'
          }
        },
        handler: serve
      })
  }
}

const args = cli.command(command)
if (require.main === module) args.demandCommand().argv
else module.exports = args

function dev (argv) {
  const cmd = exec('npm start', {
    stdio: 'inherit',
    cwd: __dirname
  })
  cmd.stdout.pipe(process.stdout)
  cmd.stderr.pipe(process.stderr)
}

function serve (argv) {
  const TOKEN_HEADER = 'x-sonar-access-token'
  const endpoint = argv.endpoint || 'http://localhost:9191/api'
  const app = express()
  const token = crypto.randomBytes(16).toString('hex')
  const path = p.join(__dirname, 'dist')
  app.use(express.static(path))

  if (argv.insecureApiProxy) {
    // To be able to actually serve a useful remote UI a proxy
    // onto the API server is created.
    // TODO: Rethink this of course!
    // Likely it should work the other way round:
    // - The server opens a proxy for the API (or just serves it)
    // - The token is checked there
    // And then use proper ephemeral tokens or hashes.
    const proxy = httpProxy.createServer()
    app.use('/api', (req, res, next) => {
      // A very (too) simple auth scheme: if you have the single
      // token per running session, you're good. otherwise not.
      // The UI can remember the token for you.
      if (req.headers[TOKEN_HEADER] !== token) {
        return res.status(401).send({ error: 'invalid access token' })
      }
      proxy.web(req, res, { target: endpoint })
    })
  }

  const { port, hostname } = argv
  app.listen(port, hostname, (err) => {
    if (err) return console.error(err)
    const link = `http://${hostname}:${port}`
    console.log(`UI listening on ${link}`)
    if (argv.insecureApiProxy) console.log(`Link with API access:\n${link}/#/token/${token}`)
    if (argv.open) open(link)
  })
}

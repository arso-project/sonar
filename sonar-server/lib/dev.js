const p = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')

module.exports = { initTop, initBottom }

function initTop (app, opts) {
  // If in dev mode, serve the webpack dev middleware for the UI at /ui-dev
  if (opts.uiWatch) {
    const uiDevMiddleware = require('@arsonar/ui/express-dev')
    uiDevMiddleware(app, { publicPath: '/ui-dev', workdir: opts.workdir })
  }

  // express-oas-generator: handle responses
  if (opts.expressOas) {
    const oas = require('express-oas-generator')
    const openAPIFilePath = p.join(__dirname, '..', 'docs', 'swagger.json')
    mkdirp.sync(p.parse(openAPIFilePath).dir)
    let predefinedSpec
    try {
      predefinedSpec = JSON.parse(
        fs.readFileSync(openAPIFilePath, { encoding: 'utf-8' })
      )
    } catch (e) {}
    oas.handleResponses(app, {
      specOutputPath: openAPIFilePath,
      writeIntervalMs: 0,
      predefinedSpec: predefinedSpec ? () => predefinedSpec : undefined,
      tags: ['collection']
    })
  }
}

function initBottom (app, opts) {
  // express-oas-generator: handle requests
  if (opts.expressOas) {
    const oas = require('express-oas-generator')
    oas.handleRequests(app)
  }
}

const { Client } = require('@arso-project/sonar-client')
const p = require('path')
const Bots = require('.')

const client = new Client()
const bots = new Bots(client)

const repl = require('repl')
const r = repl.start('> ')
const historyPath = p.join(__dirname, '.repl-history')
r.setupHistory(historyPath, err => {
  if (err) console.error('error writing history', err)
})
r.context.client = client
r.context.bots = bots

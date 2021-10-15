#!/usr/bin/env node

const args = require('@arsonar/cli')
args.command(require('@arsonar/bots/bin.js'))
args.command(require('./bin/start.js'))
args.command(require('./bin/server.js'))

if (require.main === module) args.help().demandCommand().argv
else module.exports = args

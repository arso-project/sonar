#!/usr/bin/env node

const args = require('@arso-project/sonar-cli')
args.command(require('./bin/start.js'))
args.command(require('./bin/server-start.js'))
// optional includes
try {
  args.command(require('@arso-project/sonar-ui/bin.js'))
} catch (e) {}
if (require.main === module) args.demandCommand().argv
else module.exports = args

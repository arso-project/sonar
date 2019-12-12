#!/usr/bin/env node

const args = require('@arso-project/sonar-cli')
args.commandDir('bin')
// optional includes
try {
  args.command(require('@arso-project/sonar-ui/bin.js'))
} catch (e) {}
if (require.main === module) args.demandCommand().argv
else module.exports = args

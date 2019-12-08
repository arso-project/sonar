#!/usr/bin/env node

const cli = require('@arso-project/sonar-cli')
const args = cli.commandDir('bin').demandCommand()
try {
  args.builder(require('@arso-project/sonar-ui/bin.js'))
} catch (e) {}
if (require.main === module) args.argv
else module.exports = args

#!/usr/bin/env node

const { exec } = require('child_process')
const cli = require('@arso-project/sonar-cli')
const args = cli.command('ui', 'start sonar ui', argv => {
  const cmd = exec('npm start', {
    stdio: 'inherit',
    cwd: __dirname
  })
  cmd.stdout.pipe(process.stdout)
  cmd.stderr.pipe(process.stderr)
})

if (require.main === module) args.demandCommand().argv
else module.exports = args

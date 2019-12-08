#!/usr/bin/env node

const { exec } = require('child_process')
const cli = require('@arso-project/sonar-cli')
const open = require('open')

const command = {
  command: 'ui [dev|serve]',
  describe: 'ui',
  builder: yargs => {
    yargs.command({
      command: 'dev',
      describe: 'start sonar ui (dev mode)',
      handler: argv => {
        const cmd = exec('npm start', {
          stdio: 'inherit',
          cwd: __dirname
        })
        cmd.stdout.pipe(process.stdout)
        cmd.stderr.pipe(process.stderr)
      }
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
          }
        },
        handler: argv => {
          const express = require('express')
          const app = express()
          app.use(express.static('./dist'))
          const { port, hostname } = argv
          app.listen(port, hostname, (err) => {
            if (err) return console.error(err)
            const link = `http://${hostname}:${port}`
            console.log(`UI listening on ${link}`)
            open(link)
          })
        }
      })
  }
}

const args = cli.command(command)
if (require.main === module) args.demandCommand().argv
else module.exports = args

const minimist = require('minimist')

const createServer = require('.')

const argv = minimist(process.argv.slice(2), {
  alias: {
    p: 'port',
    s: 'storage',
    k: 'key'
  }
})

const opts = {
  port: argv.port || 9191,
  storage: argv.storage || './.data',
  key: argv.key || null
}

const server = createServer(opts)
server.listen(opts.port)

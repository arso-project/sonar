const exitHook = require('async-exit-hook')
const p = require('path')
const fs = require('fs')
const net = require('net')
const os = require('os')

module.exports = localSocketStream

function localSocketStream (name, onstream) {
  const basedir = p.join(os.tmpdir(), 'local-socket-streams')
  fs.mkdir(basedir, err => {
    if (err && err.code !== 'EEXIST') return onstream(err)
    makeStream({ basedir, name }, onstream)
  })
}

function makeStream (opts, cb) {
  const { basedir, name, reconnect } = opts
  const sockPath = p.join(basedir, name + '.sock')
  const pidPath = p.join(basedir, name + '.pid')

  fs.readFile(pidPath, (err, buf) => {
    if (err) return startServer(cb)
    const pid = parseInt(buf.toString())
    try {
      // This does NOT kill the process. It sends signal 0 to pid,
      // which has no effect but throws if the process doesnt exist.
      process.kill(pid, 0)
      startClient(cb)
    } catch (err) {
      fs.unlink(sockPath, (err) => {
        if (err && err.code !== 'ENOENT') return cb(err)
        startServer(cb)
      })
    }
  })

  function startServer () {
    const pidbuf = Buffer.from(String(process.pid))
    fs.writeFile(pidPath, pidbuf, err => {
      if (err) return cb(err)

      exitHook(shutdownServer)

      // Start server.
      const server = net.createServer(onstream)
      server.listen(sockPath)
      // server.on('error', err => console.error('server ERROR', err))
      function onstream (stream) {
        cb(null, stream)
        // stream.on('error', err => console.error('server stream ERROR', err))
      }
    })
  }

  function shutdownServer () {
    try {
      fs.unlinkSync(pidPath)
      fs.unlinkSync(sockPath)
    } catch (e) {}
  }

  function startClient () {
    const stream = net.connect(sockPath)
    cb(null, stream)
    if (reconnect) {
      stream.on('end', () => setTimeout(() => makeStream(opts, cb), 100))
    }
  }
}

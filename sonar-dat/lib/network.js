const localSocketStream = require('./local-socket-stream.js')
const hyperswarm = require('@hyperswarm/replicator')
const log = require('./log')

module.exports = class Network {
  constructor (opts) {
    this.opts = opts
    this.replicating = {}
  }

  add (island) {
    island.ready(() => {
      this.replicating[island.key] = island
      replicateLocal(island)
      replicateHyperswarm(island)
      console.log('replicating: ' + island.key.toString('hex'))
    })
  }

  remove (island) {
    // TODO.
  }
}

function replicateLocal (island) {
  // const name = 'archipel-' + island.discoveryKey.toString('hex')
  const name = 'archipel-replication'
  localSocketStream(name, (err, stream) => {
    if (err) return console.error('cannot setup local replication: ', err)
    const repl = island.replicate({ encrypt: false, live: true })
    repl.pipe(stream).pipe(repl)
  })
}

function replicateHyperswarm (island) {
  const swarm = hyperswarm(island.multidrive.primaryDrive, {
    live: true,
    announce: true,
    lookup: true
  })
  swarm.on('join', dkey => log.debug('Joining swarm for %s', dkey.toString('hex')))
  swarm.on('connection', peer => log.info('New peer'))
  island.sources(drives => {
    for (const drive of drives) {
      swarm.join(drive.discoveryKey)
    }
  })
  island.on('source', drive => {
    swarm.join(drive.discoveryKey)
  })
}

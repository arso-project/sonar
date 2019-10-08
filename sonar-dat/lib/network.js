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
    })
  }

  remove (island) {
    // TODO.
  }
}

function replicateLocal (store) {
  // const name = 'archipel-' + store.discoveryKey.toString('hex')
  const name = 'archipel-replication'
  localSocketStream(name, (err, stream) => {
    if (err) return console.error('cannot setup local replication: ', err)
    const repl = store.replicate({ encrypt: false, live: true })
    repl.pipe(stream).pipe(repl)
  })
}

function replicateHyperswarm (store) {
  const swarm = hyperswarm(store.multidrive.primaryDrive, {
    live: true,
    announce: true,
    lookup: true
  })
  swarm.on('join', dkey => log.debug('Joining swarm for %s', dkey.toString('hex')))
  swarm.on('connection', peer => log.info('New peer'))
  store.sources(drives => {
    for (const drive of drives) {
      swarm.join(drive.discoveryKey)
    }
  })
  store.on('source', drive => {
    swarm.join(drive.discoveryKey)
  })
}

const localswarm = require('simple-local-swarm')
const hyperswarm = require('hyperswarm')
const Protocol = require('hypercore-protocol')
const log = require('./log')
const pump = require('pump')

module.exports = class Network {
  constructor (opts = {}) {
    this.opts = opts
    this.replicating = {}
    this.hyperswarm = hyperswarm({ announceLocalAddress: !!opts.announceLocalAddress })
    this.localswarm = localswarm()
    this.hyperswarm.on('connection', this._onconnection.bind(this))
    this.localswarm.on('connection', this._onconnection.bind(this))
  }

  add (island) {
    island.ready(() => {
      const dkey = island.discoveryKey
      const hdkey = dkey.toString('hex')
      if (this.replicating[hdkey]) return
      this.replicating[hdkey] = island
      this.hyperswarm.join(dkey)
      this.localswarm.join(dkey)
      console.log('swarming: ' + hdkey)
    })
  }

  remove (island) {
    // TODO.
  }

  close () {
    this.hyperswarm.destroy()
    this.localswarm.close()
  }

  _onconnection (socket, details) {
    const isInitiator = !!details.client
    console.log('onconnection', isInitiator, dkey ? dkey.toString('hex') : null)
    // const proto = new Protocol(isInitiator)
    var stream = null
    const dkey = details.peer ? details.peer.topic : null
    if (isInitiator) {
      const island = this.replicating[dkey.toString('hex')]
      if (!island) {
        console.log('invalid discovery key')
        socket.destroy()
        return
      }
      console.log('start replication!')
      stream = island.corestore.replicate(true, dkey)
    } else {
      stream = new Protocol(false)
      stream.once('discovery-key', dkey => {
        console.log('ondiscoverykey', dkey.toString('hex'))
        const island = this.replicating[dkey.toString('hex')]
        if (!island) {
          console.log('invalid discovery key')
        } else {
          console.log('start replication!')
          island.corestore.replicate(false, dkey, { stream })
        }
      })
    }
    pump(stream, socket, stream)
    socket.on('error', err => {
      console.log('socket error', err)
    })
    stream.on('error', err => {
      console.log('proto error', err)
    })
    // const proto = this.corestore.replicate(isInitiator, dkey)
    // if (details.peer && details.peer.topic) {
    //   const hdkey = details.peer.topic.toString('hex')
    //   const island = this.replicating[hdkey]
    //   console.log('replicate', hdkey)
    //   island.replicate(isInitiator, { stream: proto })
    // }
    // proto.on('discovery-key', (discoveryKey) => {
    //   const hdkey = details.peer.topic.toString('hex')
    //   console.log('ondiscoverykey go', hdkey)
    //   const island = this.replicating[hdkey]
    //   if (island) {
    //     console.log('ondiscoverykey go', discoveryKey)
    //     island.replicate(isInitiator, { stream: proto })
    //   } else {
    //     console.log('ondiscoverykey not found', discoveryKey)
    //   }
    // })
    // proto.on('error', err => {
    //   console.error('error', err)
    // })
    // pump(proto, stream, proto)
  }
}

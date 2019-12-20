const localswarm = require('simple-local-swarm')
const hyperswarm = require('hyperswarm')
const Protocol = require('hypercore-protocol')
const log = require('./log')
const debug = require('debug')('sonar-dat:network')
const pump = require('pump')

module.exports = class Network {
  constructor (opts = {}) {
    this.opts = opts
    this.replicating = {}
    this.peers = {}
    this.hyperswarm = hyperswarm({ announceLocalAddress: !!opts.announceLocalAddress })
    this.localswarm = localswarm()
    this.hyperswarm.on('connection', this._onconnection.bind(this))
    this.localswarm.on('connection', this._onconnection.bind(this))
    // This always emits when the remote closes, so do nothing for now.
    this.localswarm.on('error', () => {})
  }

  status (cb) {
    const shared = Object.values(this.replicating).map(island => ({
      dkey: island.discoveryKey.toString('hex'),
      key: island.key.toString('hex'),
      name: island.localname,
      peers: this.peers[island.discoveryKey.toString('hex')].length
    }))
    cb(null, {
      shared
    })
  }

  add (island) {
    island.ready(() => {
      const dkey = island.discoveryKey
      const hdkey = dkey.toString('hex')
      if (this.replicating[hdkey]) return
      this.replicating[hdkey] = island
      this.peers[hdkey] = []
      this.hyperswarm.join(dkey)
      this.localswarm.join(dkey)
      debug('swarming: ' + hdkey)
    })
  }

  remove (island) {
    // TODO.
  }

  close (cb = noop) {
    Object.values(this.peers).forEach(peer => peer.stream && peer.stream.destroy())
    this.hyperswarm.destroy(() => {
      this.localswarm.close(() => cb())
    })
  }

  _onpeer ({ stream, discoveryKey }) {
    this.peers[discoveryKey] = this.peers[discoveryKey] || []
    this.peers[discoveryKey].push(stream)
  }

  _onconnection (socket, details) {
    const isInitiator = !!details.client
    // const proto = new Protocol(isInitiator)
    var stream = null
    const dkey = details.peer ? details.peer.topic : null
    debug('onconnection', isInitiator, dkey ? dkey.toString('hex') : null)
    if (isInitiator) {
      const hdkey = dkey.toString('hex')
      const island = this.replicating[hdkey]
      if (!island) {
        debug('invalid discovery key')
        socket.destroy()
        return
      }
      debug('start replication!')
      stream = island.corestore.replicate(true, dkey)
      this._onpeer({ stream, discoveryKey: hdkey, island })
    } else {
      stream = new Protocol(false)
      stream.once('discovery-key', dkey => {
        debug('ondiscoverykey', dkey.toString('hex'))
        const hdkey = dkey.toString('hex')
        const island = this.replicating[hdkey]
        if (!island) {
          debug('invalid discovery key')
        } else {
          debug('start replication!')
          island.corestore.replicate(false, dkey, { stream })
          this._onpeer({ stream, discoveryKey: hdkey, island })
        }
      })
    }
    pump(stream, socket, stream)
    socket.on('error', err => {
      debug('socket error', err)
    })
    stream.on('error', err => {
      debug('proto error', err)
    })
  }
}

function noop () {}

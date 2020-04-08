const localswarm = require('simple-local-swarm')
const hyperswarm = require('hyperswarm')
const Protocol = require('hypercore-protocol')
const log = require('./log')
const debug = require('debug')('sonar-core:network')
const pump = require('pump')
const pretty = require('pretty-hash')

module.exports = class Network {
  constructor (opts = {}) {
    this.opts = opts
    this.replicating = {}
    this.peers = {}
    this.hyperswarm = hyperswarm({
      announceLocalAddress: !!opts.announceLocalAddress,
      // ephemeral: true // TODO: set to false for long running processes
      validatePeer (peer) {
        // debug('validate peer', peer)
        return true
      }
      // multiplex: false // TODO: enable connection deduplication
    })
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
      name: island.name,
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
      this.hyperswarm.join(dkey, {
        lookup: true,
        announce: true // TODO: Maybe not always announce?
      })
      this.localswarm.join(dkey)
      debug('swarming: ' + island.name + ' ' + pretty(hdkey))
    })
  }

  remove (island) {
    // TODO.
  }

  close (cb = noop) {
    Object.values(this.peers).forEach(peer => peer.stream && peer.stream.destroy())
    // TODO: the destroy method of hyperswarm can also take a callback.
    // Awaiting this callback takes a long time. Investigate why this
    // is the case and what's it needed for. For now, the callback is
    // not awaited because of how long it takes and because things seem
    // to work this way too.
    this.hyperswarm.destroy()
    this.localswarm.close(cb)
  }

  _onpeer ({ stream, discoveryKey }) {
    stream.on('error', err => debug('error', err))
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
      debug('start replication [init: true]!')
      stream = island.replicate(true, { live: true })
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
          debug('start replication [init: false]')
          island.replicate(false, { stream, live: true })
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

module.exports.NoNetwork = class NoNetwork {
  add () {}
  remove () {}
  status (cb) { cb(null, {}) }
  close (cb) { cb() }
}

function noop () {}

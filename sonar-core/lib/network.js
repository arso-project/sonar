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

  islandStatus (island) {
    const hdkey = island.discoveryKey.toString('hex')
    if (!this.replicating[hdkey]) return { shared: false }
    const peers = this.peers[hdkey].length
    return { shared: true, peers }
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
    island.ready(() => {
      const hdkey = island.discoveryKey.toString('hex')
      if (!this.replicating[hdkey]) return
      for (const peer of this.peers[hdkey]) {
        if (peer.protocol && !peer.protocol.destroyed) peer.protocol.destroy()
      }
      this.replicating[hdkey] = undefined
    })
  }

  close (cb = noop) {
    this._closing = true
    Object.values(this.peers).forEach(peer => {
      if (peer.protocol && !peer.protocol.destroyed) peer.protocol.destroy()
    })
    // TODO: the destroy method of hyperswarm can also take a callback.
    // Awaiting this callback takes a long time. Investigate why this
    // is the case and what's it needed for. For now, the callback is
    // not awaited because of how long it takes and because things seem
    // to work this way too.
    process.nextTick(() => {
      this.hyperswarm.destroy()
      this.localswarm.close(() => {
        this._closing = false
        this.opened = false
        cb()
      })
    })
  }

  _onpeer (dkey, protocol) {
    const hdkey = dkey.toString('hex')
    const island = this.replicating[hdkey]
    if (!island) {
      debug('unknown discovery key', dkey.toString('hex'))
      return
    }

    debug('start replication [init: false, discoveryKey: %s]', hdkey)
    island.replicate(null, { stream: protocol, live: true })
    this.peers[hdkey] = this.peers[hdkey] || []
    this.peers[hdkey].push({ protocol, discoveryKey: dkey })
  }

  _onconnection (socket, details) {
    socket.on('error', err => {
      if (!this._closing) debug('socket error', err)
    })

    const isInitiator = !!details.client
    const dkey = details.peer ? details.peer.topic : null

    const protocol = new Protocol(isInitiator, { live: true })
    protocol.on('error', err => debug('protocol error', err))

    if (isInitiator) {
      debug('start protocol [init: true]')
      this._onpeer(dkey, protocol)
    } else {
      debug('start protocol [init: false]')
      protocol.once('discovery-key', dkey => {
        this._onpeer(dkey, protocol)
      })
    }

    pump(protocol, socket, protocol)
  }
}

module.exports.NoNetwork = class NoNetwork {
  add () {}
  remove () {}
  status (cb) { cb(null, {}) }
  islandStatus (island, cb) { cb(null, { share: false }) }
  close (cb) { cb() }
}

function noop () {}

const dht = require('@hyperswarm/dht')

const BOOTSTRAP_PORT = 3100
const BOOTSTRAP_ADDRESS = `localhost:${BOOTSTRAP_PORT}`

var bootstrap = null

async function initDht () {
  if (!bootstrap) {
    bootstrap = dht({
      bootstrap: false
    })
    bootstrap.listen(BOOTSTRAP_PORT)
    await new Promise(resolve => {
      return bootstrap.once('listening', resolve)
    })
  }
}

async function cleanupDht () {
  if (bootstrap) {
    await bootstrap.destroy()
    bootstrap = null
  }
}

module.exports = { BOOTSTRAP_PORT, BOOTSTRAP_ADDRESS, initDht, cleanupDht }

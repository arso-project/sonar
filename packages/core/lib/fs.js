const hyperdrive = require('hyperdrive')

module.exports = function registerHyperdrive (workspace) {
  workspace.on('collection-opening', (collection, onOpen) => {
    onOpen(onCollectionOpen(collection))
  })
}

async function onCollectionOpen (collection) {
  const drives = new Map()
  const map = new Map()
  const namespace = collection.id + ':sonar-hyperdrive'
  const corestore = collection._workspace.corestore.namespace(namespace)

  // Add the local drive key to the status.
  collection.on('status', status => {
    if (map.has('~me')) status.localDrive = map.get('~me')
  })

  // TODO: Move into collection.api
  collection.drive = getDrive

  // Create a live stream for future drives being added to the collection.
  collection
    .createQueryStream(
      'records',
      { type: 'sonar/feed' },
      { live: true, old: false }
    )
    .on('data', onFeedRecord)

  // Query for hyperdrive feeds in the corrent collection.
  const rs = collection.createQueryStream('records', { type: 'sonar/feed' })
  rs.on('data', onFeedRecord)
  await new Promise((resolve, reject) => {
    rs.once('error', reject)
    rs.once('end', resolve)
  })

  // If no local drive exists, create it now.
  // TODO: Only do this on-demand (on first use)?
  if (!map.has('~me')) {
    await initLocalDrive()
  }

  async function getDrive (keyOrAlias) {
    if (!map.has(keyOrAlias)) throw new Error('Drive not found: ' + keyOrAlias)
    const key = map.get(keyOrAlias)
    if (drives.has(key)) {
      const drive = drives.get(key)
      if (!drive.opened) {
        await new Promise(resolve => drive.ready(resolve))
      }
    }
    const drive = hyperdrive(corestore, key)
    drives.set(key, drive)
    if (!drive.opened) {
      await new Promise(resolve => drive.ready(resolve))
    }
    return drive
  }

  function onFeedRecord (record) {
    const feedInfo = record.value
    if (feedInfo.type === 'hyperdrive') {
      map.set(feedInfo.key, feedInfo.key)
      if (feedInfo.alias) map.set(feedInfo.alias, feedInfo.key)
      if (record.key === collection.localKey.toString('hex')) {
        map.set('~me', feedInfo.key)
      }
    }
  }

  async function initLocalDrive () {
    const localDriveFeed = corestore.default()
    const drive = hyperdrive(corestore, localDriveFeed.key)
    await new Promise(resolve => drive.ready(resolve))
    const record = await collection.putFeed(drive.key.toString('hex'), {
      type: 'hyperdrive',
      alias: collection.name
    })
    const key = record.value.key
    drives.set(key, drive)
    map.set(key, key)
    map.set(record.value.alias, key)
    map.set('~me', key)
  }

  async function onClose () {
    for (const drive of drives.values()) {
      await drive.close()
    }
  }

  return { getDrive, onClose }
}

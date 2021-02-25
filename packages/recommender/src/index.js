const { Workspace } = require('@arsonar/core')
const { EventEmitter } = require('events')
const prettyHash = require('pretty-hash')

const TYPE_RATING = {
  name: 'rating',
  namespace: 'sonar',
  fields: {
    rating: {
      title: 'Rating',
      type: 'number'
    },
    subject: {
      title: 'Subject',
      type: 'string'
    }
  }
}

main().catch(console.error)

// sids friends: ege
// eges friends: franz
// franz friends: (none)

async function main () {
  const names = ['sid', 'ege', 'franz']
  const collections = await Promise.all(names.map(name => createPeer(name)))

  const [[ws1, col1], [ws2, col2], [ws3, col3]] = collections

  await col1.putFeed(col2.key)
  await col2.putFeed(col3.key)

  // timeout for now to wait for everything to sync up
  await new Promise(resolve => setTimeout(resolve, 1000))

  // this doesn't work unfortunately..
  // await col1.sync()
  // await col1.update()
  // await col1.sync()
  // await col1.sync()

  const ratings = await col1.query('records', { type: 'sonar/rating' })
  console.log(ratings)

  // close everything
  for (const ws of [ws1, ws2, ws3]) {
    await ws.close()
  }
}

async function createPeer (name) {
  const storagePath = '/tmp/sonar-recommender-' + name
  const workspace = new Workspace({ storagePath, defaultViews: false })
  await workspace.open()
  const collection = await initLocalCollection(workspace, name)
  await collection.sync()
  return [workspace, collection]
}

async function initLocalCollection (workspace, name) {
  const collection = await workspace.openCollection('local-' + name)

  if (!collection.schema.hasType('sonar/rating')) {
    await collection.putType(TYPE_RATING)
    await addRatings(collection, name)
  }

  // logEvents(collection, name)
  return collection
}

async function addRatings (collection, name) {
  const record1 = {
    type: 'sonar/rating',
    value: {
      rating: Math.random(),
      subject: 'foo' + name
    }
  }
  const record2 = {
    type: 'sonar/rating',
    value: {
      rating: Math.random(),
      subject: 'bar' + name
    }
  }
  await collection.put(record1)
  await collection.put(record2)
}

function logEvents (collection, name) {
  // log some events
  const peers = new Set()
  collection.on('peer-open', (feed, peer) => {
    const peerKey = peer.remotePublicKey.toString('hex')
    if (!peers.has(peerKey)) {
      peers.add(peerKey)
      console.log(`[${name}] peer-open to ${prettyHash(peer.remotePublicKey)}`)
    }
  })
  collection.on('update', lseq => console.log(`[${name}] update, new local len ${lseq}`))
  collection.on('remote-update', feed => console.log(`[${name}] remote-update on feed`, prettyHash(feed.key)))
  collection.on('feed-update', (feed, method, details) => console.log(`[${name}] feed-update`, prettyHash(feed.key), method, details))
}

// experiment to track incoming feeds and remote updates
// to determine when you're "done" updating your feeds
// const friends = new Set()
// const pendingUpdates = new Set()
// const doneUpdates = new Set()
// const readyEmitter = new EventEmitter()
// col1.createQueryStream(
//   'records',
//   { type: 'sonar/feed' },
//   { live: true }
// ).on('data', record => {
//   const key = record.value.key
//   if (key === col1.key.toString('hex')) return
//   if (!pendingUpdates.has(key)) {
//     console.log('!!! ADD', key)
//     // friends.add(record.value.key)
//     if (doneUpdates.has(key)) {
//       doneUpdates.delete(key)
//     } else {
//       pendingUpdates.add(key)
//     }
//     if (pendingUpdates.size === 0 && doneUpdates.size === 0) {
//       console.log('!!! READY !!!')
//       readyEmitter.emit('ready')
//     }
//   }
// })

// col1.on('remote-update', feed => {
//   const key = feed.key.toString('hex')
//   console.log('REMTOE UPDATE', key)
//   // console.log('pending len', pendingUpdates.size)
//   if (pendingUpdates.has(key)) {
//     pendingUpdates.delete(key)
//   } else {
//     doneUpdates.add(key)
//   }
//   if (pendingUpdates.size === 0 && doneUpdates.size === 0) {
//     console.log('!!! READY !!!')
//     readyEmitter.emit('ready')
//   }
// })

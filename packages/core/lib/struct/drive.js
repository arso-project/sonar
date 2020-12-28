const { Stat } = require('hyperdrive-schemas')
const mime = require('mime')
const { Node } = require('hypertrie/lib/messages')
const crypto = require('crypto')
const { deriveId } = require('../util')

module.exports = { get }
// const DRIVE = Symbol('hyperdrive')

async function get (feed, req) {
  const key = feed.key.toString('hex')
  const seq = req.seq

  const value = await feed.get(seq)

  let node, stat, path

  try {
    node = Node.decode(value)
    path = node.key
  } catch (err) {
    throw err
  }

  try {
    stat = Stat.decode(node.valueBuffer)
  } catch (err) {
    throw err
  }

  if (!stat.isFile()) return null

  const pathParts = path.split('/')
  const filename = pathParts.pop() || '/'

  const url = 'hyper://' + key + '/' + path
  let id
  if (stat.metadata['sonar.id']) {
    id = stat.metadata['sonar.id'].toString()
  } else {
    id = deriveId(url)
  }

  // const hash = crypto.createHash('sha256')
  // hash.update(url)
  // const id = hash.digest('hex')

  const encodingFormat = mime.getType(filename)

  const data = {
    ...req,
    id,
    type: 'sonar/resource',
    links: [],
    value: {
      filename,
      contentUrl: url,
      contentSize: stat.size,
      encodingFormat
    }
  }
  return data
}

// function createHyperdriveLoader (corestore) {
//   // const drives = new Map()
//   return { onload }

//   function Hyperdrive (key) {
//     if (!drives.has(key)) {
//       drives.set(key, hyperdrive(corestore, key))
//     }
//     return drives.get(key)
//   }
// }

const { Stat } = require('hyperdrive-schemas')
const mime = require('mime-types')
const { Node } = require('hypertrie/lib/messages')
const { deriveId } = require('../util')

module.exports = { get, decodeBlock }

async function get (feed, req) {
  const seq = req.seq
  const block = await feed.get(seq)
  return decodeBlock(block, req)
}

function decodeBlock (block, req) {
  if (Buffer.isBuffer(req.key)) req.key = req.key.toString('hex')
  const node = Node.decode(block)
  const path = node.key
  const stat = Stat.decode(node.valueBuffer)

  // Ignore directories.
  if (!stat.isFile()) return null

  const pathParts = path.split('/')
  const filename = pathParts.pop() || '/'

  const url = 'hyper://' + req.key + '/' + path
  let id
  if (stat.metadata['sonar.id']) {
    id = stat.metadata['sonar.id'].toString()
  } else {
    id = deriveId(url)
  }

  // const hash = crypto.createHash('sha256')
  // hash.update(url)
  // const id = hash.digest('hex')

  const encodingFormat = mime.lookup(filename)

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

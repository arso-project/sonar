const { Stat } = require('hyperdrive-schemas')
const mime = require('mime')
const { Node } = require('hypertrie/lib/messages')
const crypto = require('crypto')

module.exports = onload

function onload (schema, message, cb) {
  const { key, seq, lseq, value } = message

  let node, stat, path

  try {
    node = Node.decode(value)
    path = node.key
  } catch (err) {
    return cb(err)
  }

  try {
    stat = Stat.decode(node.valueBuffer)
  } catch (err) {
    return cb(err)
  }

  const pathParts = path.split('/')
  const filename = pathParts.pop() || '/'

  const url = 'hyper://' + key + '/' + path

  const hash = crypto.createHash('sha256')
  hash.update(url)
  const id = hash.digest('hex')

  const encodingFormat = mime.getType(filename)

  const data = {
    key,
    seq,
    lseq,
    id,
    type: 'sonar/resource',
    links: [],
    value: {
      label: filename,
      contentUrl: url,
      contentSize: stat.size,
      encodingFormat
    }
  }
  const record = schema.Record(data)
  console.log('PUSH', record)
  cb(null, record)
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

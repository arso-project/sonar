const RecordEncoder = require('../record-encoder')

module.exports = { decodeBlock }

function decodeBlock (block, req) {
  const decoded = RecordEncoder.decode(block, req)
  return decoded
}

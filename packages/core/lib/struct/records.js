const RecordEncoder = require('../record-encoder')

module.exports = { get }

async function get (feed, req) {
  const block = await feed.get(req.seq)
  const decoded = RecordEncoder.decode(block, req)
  return decoded
}

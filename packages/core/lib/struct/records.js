const RecordEncoder = require('../record-encoder')

module.exports = { get, decodeBlock }

async function get (feed, req, opts = {}) {
  if (opts.wait === undefined) opts.wait = true
  const block = await feed.get(req.seq, opts)
  return decodeBlock(block, req)
}

function decodeBlock (block, req) {
  const decoded = RecordEncoder.decode(block, req)
  return decoded
}

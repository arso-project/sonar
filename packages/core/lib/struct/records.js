const RecordEncoder = require('../record-encoder')

module.exports = { get }

async function get (feed, req, opts = {}) {
  if (opts.wait === undefined) opts.wait = false
  const block = await feed.get(req.seq, opts)
  const decoded = RecordEncoder.decode(block, req)
  return decoded
}

const hyperdriveHttp = require('hyperdrive-http')

module.exports = function apiRoutes (fastify, opts, done) {
  const islands = opts.islands

  fastify.get('/:key/*', (req, res) => {
    const { key } = req.params
    islands.get(key, (err, island) => {
      if (err) return res.code(404).send('Not found')
      // TODO: Clearer API method in hyper-content-db to get a drive instance.
      island.writer((err, drive) => {
        if (err) return res.code(404).send('Not found')
        const handler = hyperdriveHttp(drive)
        const rawReq = req.req
        rawReq.url = rawReq.url.substring(opts.prefix.length + key.length + 2)
        handler(rawReq, res.res)
      })
    })
  })
  done()
}

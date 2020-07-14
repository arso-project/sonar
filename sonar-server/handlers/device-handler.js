module.exports = function createDeviceHandler (collections) {
  return {
    info (req, res, next) {
      collections.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
    },

    createCollection (req, res, next) {
      const { name, key, alias } = req.body
      collections.create(name, { key, alias }, (err, collection) => {
        if (err) return next(err)
        res.send({
          key: collection.key.toString('hex')
        })
        res.end()
      })
    },

    updateCollection (req, res, next) {
      collections.updateCollection(req.collection.key, req.body, (err, newConfig) => {
        if (err) return next(err)
        res.send(newConfig)
      })
    }
  }
}

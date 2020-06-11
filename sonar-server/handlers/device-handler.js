module.exports = function createDeviceHandler (islands) {
  return {
    info (req, res, next) {
      islands.status((err, status) => {
        if (err) return next(err)
        res.send(status)
      })
    },

    createIsland (req, res, next) {
      const { name } = req.params
      const { key, alias } = req.body
      islands.create(name, { key, alias }, (err, island) => {
        if (err) return next(err)
        res.send({
          key: island.key.toString('hex')
        })
        res.end()
      })
    },

    updateIsland (req, res, next) {
      islands.updateIsland(req.island.key, req.body, (err, newConfig) => {
        if (err) return next(err)
        res.send(newConfig)
      })
    }
  }
}

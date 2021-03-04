module.exports = function asyncHandler (handlerFn) {
  return function (req, res, next) {
    const promise = handlerFn(req, res, next)
    promise
      .catch(next)
      .then(data => {
        if (data === undefined) return
        res.send(data)
      })
  }
}

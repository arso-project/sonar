function once (fn) {
  let called = false
  return (...args) => {
    if (!called) fn(...args)
    called = true
  }
}

module.exports = { once }

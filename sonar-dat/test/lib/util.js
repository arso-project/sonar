module.exports = { stepper }

function stepper (cb) {
  const steps = []
  return function step (name, fn) {
    if (!fn) return step(null, name)
    if (!name) name = steps.length
    steps.push({ fn, name })
    if (steps.length === 1) process.nextTick(run)
  }
  function run (lastResult) {
    const { fn, name } = steps.shift()
    console.log(`> step ${name}`)
    fn(done, lastResult)
  }
  function done (err, result) {
    if (err) return cb(err)
    if (steps.length) process.nextTick(run, result)
    else cb(null, result)
  }
}

const kSubs = Symbol('kSubs')

module.exports = class SimpleEmitter {
  constructor () {
    this[kSubs] = new Set()
  }

  subscribe (fn, triggerNow = false) {
    this[kSubs].add(fn)
    if (triggerNow) fn(this)
    return () => this[kSubs].delete(fn)
  }

  emit () {
    for (const fn of this[kSubs]) {
      fn(this)
    }
  }
}

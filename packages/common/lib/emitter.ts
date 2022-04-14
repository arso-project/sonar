const kSubs = Symbol('kSubs')
const kSelf = Symbol('kSelf')

export type EmitCb<T> = (obj: T) => void

export class Emitter<T> {
  [kSubs]: Set<EmitCb<T>> = new Set();
  [kSelf]: T;

  constructor(self: T) {
    this[kSelf] = self
  }

  subscribe (fn: EmitCb<T>, triggerNow = false) {
    this[kSubs].add(fn)
    if (triggerNow) { fn(this[kSelf]) }
    return () => this[kSubs].delete(fn)
  }

  emit () {
    for (const fn of this[kSubs]) {
      fn(this[kSelf])
    }
  }
}

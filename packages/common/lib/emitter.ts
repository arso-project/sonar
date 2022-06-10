
export type EmitCb<T> = (obj: T) => void

export class Emitter<T> {
  private subscribers: Set<EmitCb<T>> = new Set();
  private value: T

  constructor (value: T) {
    this.value = value
  }

  subscribe (fn: EmitCb<T>, triggerNow = false) {
    this.subscribers.add(fn)
    if (triggerNow) {
      fn(this.value)
    }
    return () => this.subscribers.delete(fn)
  }

  emit () {
    for (const fn of this.subscribers) {
      fn(this.value)
    }
  }
}

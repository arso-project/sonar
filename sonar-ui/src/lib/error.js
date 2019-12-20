export class ErrorStore {
  constructor () {
    this.errors = []
    this.watchers = []
  }

  push (error, meta) {
    const timestamp = Date.now()
    const message = error instanceof Error ? error.message : error
    const info = { error, meta, timestamp, message }
    const ret = this.errors.push(info)
    console.error('Error: %o (meta %o)', error, meta)
    this.watchers.forEach(fn => fn(this.errors))
    return ret
  }

  watch (fn) {
    this.watchers.push(fn)
    return () => {
      this.watchers = this.watchers.filter(f => f !== fn)
    }
  }

  list () {
    return this.errors
  }

  clear () {
    this.errors = []
  }
}

const errorStore = new ErrorStore()
export default errorStore

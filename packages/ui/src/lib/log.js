export class LogStore {
  constructor () {
    this.msgs = []
    this._watchers = []
  }

  error (msg) {
    return this.log('error', msg)
  }

  debug (msg) {
    return this.log('debug', msg)
  }

  info (msg) {
    return this.log('info', msg)
  }

  log (level, msg) {
    if (typeof msg === 'string') msg = { msg }
    if (msg instanceof Error) msg = { msg: msg.message, error: msg }

    const timestamp = Date.now()

    msg = { timestamp, level, ...msg }
    this.msgs.push(msg)

    const colors = {
      error: 'red',
      info: 'blue',
      debug: 'gray'
    }
    console.log('%c%s: %c%s %o',
      `color: ${colors[level] || 'black'}; font-weight: bold;`,
      msg.level,
      'color: black; font-weight: bold;',
      msg.msg,
      msg
    )
    // console.log(type, message.message, message)
    this._update()
    return msg
  }

  watch (fn) {
    this._watchers.push(fn)
    fn(this.msgs)
    return () => {
      this._watchers = this._watchers.filter(f => f !== fn)
    }
  }

  list () {
    return this.msgs
  }

  clear () {
    this.log = []
    this._update()
  }

  _update () {
    this._watchers.forEach(fn => fn(this.msgs))
  }
}

const log = new LogStore()
window.sonarLog = log
export default log

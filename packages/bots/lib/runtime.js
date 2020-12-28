const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const { Supervisor } = require('little-process-box')
const { Transform } = require('streamx')

module.exports = class Runtime extends Nanoresource {
  constructor () {
    super()
    this.supervisor = new Supervisor()
    this.pool = this.supervisor.pool()
    this.logStream = new Transform()
  }

  async _open () {
    // await new Promise((resolve, reject) => {
    //   console.log('ino', this)
    //   this.supervisor.ready((err) => {
    //     console.log('OPN')
    //     err ? reject(err) : resolve()
    //   })
    // })
  }

  async _close () {
    await new Promise((resolve, reject) => {
      this.supervisor.stop(err => err ? reject(err) : resolve())
    })
  }

  async status () {
    const status = await new Promise((resolve, reject) => {
      this.supervisor.stat((err, results) => {
        err ? reject(err) : resolve(results)
      })
    })
    return status
  }

  async startBot (name, entry, args = [], env = {}) {
    args = [entry, ...args]
    const service = this.supervisor.service('bot.' + name, {
      pool: this.pool,
      exec: 'node',
      args,
      env
    })
    // const logs = service.createLogStream()
    // logs.once('close', () => logs.unpipe(this.logStream))

    await new Promise((resolve, reject) => {
      service.start(err => {
        err ? reject(err) : resolve()
      })
    })
    return service
  }
}

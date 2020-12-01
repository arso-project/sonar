const { Readable, Writable } = require('streamx')
const encoded = Symbol('encoded')

module.exports = class EventStream extends Writable {
  constructor (capacity) {
    super()
    this._capacity = capacity
    this._messages = []
    this._counter = 0
    this._streams = new Set()
  }

  _write (eventObject, cb) {
    this.push(eventObject)
    cb()
  }

  _destroy (cb) {
    for (const stream of this._streams) {
      stream.destroy()
    }
    cb()
  }

  get length () {
    return this._messages.length
  }

  push (event, data = {}) {
    const id = ++this._counter
    const message = { event, data, id }
    if (this._messages.length === this._capacity) {
      this._messages.shift()
    }
    this._messages.push(message)
    for (const stream of this._streams) {
      stream.push(message)
    }
    // this.emit('event', message)
  }

  createReadStream (opts = {}) {
    let { lastId, map } = opts
    if (map === 'sse') map = mapToSSE
    const stream = new Readable({ map })
    this._streams.add(stream)
    stream.on('destroy', () => this._streams.delete(stream))
    this._catchup(stream, lastId)
    return stream
  }

  _catchup (stream, lastId) {
    if (lastId && lastId < this._counter) {
      const nMissed = Math.min(this._counter - lastId, this.length)
      const start = this.length - nMissed
      const end = this.length
      for (let i = start; i <= end; i++) {
        stream.push(this._messages[i])
      }
    }
  }

  // full () {
  //   return this.length >= this.capacity
  // }

  // get capacity () {
  //   return this._capacity
  // }
  //
  // subscribe (emitter, events) {
  //   for (const [event, map] of Object.entries(events)) {
  //     const handler = (...args) => {
  //       this.push(event, map(...args))
  //     }
  //     emitter.on(event, handler)
  //   }
  // }
}

function mapToSSE (eventObject) {
  // Only stringify once.
  if (!eventObject[encoded]) {
    const data = JSON.stringify({
      event: eventObject.event,
      data: eventObject.data
    })
    // TODO: It would be nicer to pass the message type here.
    // However, the EventSource API doesn't really allow a
    // catch-all handler.
    eventObject[encoded] = {
      id: eventObject.id,
      event: 'message',
      data
    }
  }
  return eventObject[encoded]
}

const messages = require('./messages')
const HRPC = require('hrpc-runtime')
const RPC = require('hrpc-runtime/rpc')

const errorEncoding = {
  encode: messages.RPCError.encode,
  encodingLength: messages.RPCError.encodingLength,
  decode (buf, offset) {
    const { message, code, errno, details } = messages.RPCError.decode(buf, offset)
    errorEncoding.decode.bytes = messages.RPCError.decode.bytes
    const err = new Error(message)
    err.code = code
    err.errno = errno
    err.details = details
    return err
  }
}

class HRPCServiceCollection {
  constructor (rpc) {
    const service = rpc.defineService({ id: 1 })

    this._open = service.defineMethod({
      id: 1,
      requestEncoding: messages.OpenRequest,
      responseEncoding: messages.OpenResponse
    })

    this._feeds = service.defineMethod({
      id: 2,
      requestEncoding: messages.FeedsRequest,
      responseEncoding: messages.FeedsResponse
    })

    this._schema = service.defineMethod({
      id: 3,
      requestEncoding: messages.SchemaRequest,
      responseEncoding: messages.SchemaResponse
    })

    this._get = service.defineMethod({
      id: 4,
      requestEncoding: messages.GetRequest,
      responseEncoding: messages.GetResponse
    })

    this._query = service.defineMethod({
      id: 5,
      requestEncoding: messages.QueryRequest,
      responseEncoding: messages.QueryResponse
    })

    this._cancelQuery = service.defineMethod({
      id: 6,
      requestEncoding: messages.CancelQueryRequest,
      responseEncoding: RPC.NULL
    })

    this._publish = service.defineMethod({
      id: 7,
      requestEncoding: messages.PublishRequest,
      responseEncoding: messages.PublishResponse
    })

    this._subscribe = service.defineMethod({
      id: 8,
      requestEncoding: messages.SubscribeRequest,
      responseEncoding: messages.SubscribeResponse
    })

    this._pull = service.defineMethod({
      id: 9,
      requestEncoding: messages.PullRequest,
      responseEncoding: messages.PullResponse
    })

    this._ack = service.defineMethod({
      id: 10,
      requestEncoding: messages.AckRequest,
      responseEncoding: messages.AckResponse
    })

    this._sync = service.defineMethod({
      id: 11,
      requestEncoding: messages.SyncRequest,
      responseEncoding: RPC.NULL
    })

    this._onResults = service.defineMethod({
      id: 12,
      requestEncoding: messages.OnResultsRequest,
      responseEncoding: RPC.NULL
    })

    this._onUpdate = service.defineMethod({
      id: 13,
      requestEncoding: messages.OnUpdateRequest,
      responseEncoding: RPC.NULL
    })
  }

  onRequest (context, handlers = context) {
    if (handlers.open) this._open.onrequest = handlers.open.bind(context)
    if (handlers.feeds) this._feeds.onrequest = handlers.feeds.bind(context)
    if (handlers.schema) this._schema.onrequest = handlers.schema.bind(context)
    if (handlers.get) this._get.onrequest = handlers.get.bind(context)
    if (handlers.query) this._query.onrequest = handlers.query.bind(context)
    if (handlers.cancelQuery) this._cancelQuery.onrequest = handlers.cancelQuery.bind(context)
    if (handlers.publish) this._publish.onrequest = handlers.publish.bind(context)
    if (handlers.subscribe) this._subscribe.onrequest = handlers.subscribe.bind(context)
    if (handlers.pull) this._pull.onrequest = handlers.pull.bind(context)
    if (handlers.ack) this._ack.onrequest = handlers.ack.bind(context)
    if (handlers.sync) this._sync.onrequest = handlers.sync.bind(context)
    if (handlers.onResults) this._onResults.onrequest = handlers.onResults.bind(context)
    if (handlers.onUpdate) this._onUpdate.onrequest = handlers.onUpdate.bind(context)
  }

  open (data) {
    return this._open.request(data)
  }

  openNoReply (data) {
    return this._open.requestNoReply(data)
  }

  feeds (data) {
    return this._feeds.request(data)
  }

  feedsNoReply (data) {
    return this._feeds.requestNoReply(data)
  }

  schema (data) {
    return this._schema.request(data)
  }

  schemaNoReply (data) {
    return this._schema.requestNoReply(data)
  }

  get (data) {
    return this._get.request(data)
  }

  getNoReply (data) {
    return this._get.requestNoReply(data)
  }

  query (data) {
    return this._query.request(data)
  }

  queryNoReply (data) {
    return this._query.requestNoReply(data)
  }

  cancelQuery (data) {
    return this._cancelQuery.request(data)
  }

  cancelQueryNoReply (data) {
    return this._cancelQuery.requestNoReply(data)
  }

  publish (data) {
    return this._publish.request(data)
  }

  publishNoReply (data) {
    return this._publish.requestNoReply(data)
  }

  subscribe (data) {
    return this._subscribe.request(data)
  }

  subscribeNoReply (data) {
    return this._subscribe.requestNoReply(data)
  }

  pull (data) {
    return this._pull.request(data)
  }

  pullNoReply (data) {
    return this._pull.requestNoReply(data)
  }

  ack (data) {
    return this._ack.request(data)
  }

  ackNoReply (data) {
    return this._ack.requestNoReply(data)
  }

  sync (data) {
    return this._sync.request(data)
  }

  syncNoReply (data) {
    return this._sync.requestNoReply(data)
  }

  onResults (data) {
    return this._onResults.request(data)
  }

  onResultsNoReply (data) {
    return this._onResults.requestNoReply(data)
  }

  onUpdate (data) {
    return this._onUpdate.request(data)
  }

  onUpdateNoReply (data) {
    return this._onUpdate.requestNoReply(data)
  }
}

class HRPCServiceCommands {
  constructor (rpc) {
    const service = rpc.defineService({ id: 2 })

    this._command = service.defineMethod({
      id: 1,
      requestEncoding: messages.CommandRequest,
      responseEncoding: messages.CommandResponse
    })

    this._stream = service.defineMethod({
      id: 2,
      requestEncoding: messages.StreamRequest,
      responseEncoding: RPC.NULL
    })

    this._status = service.defineMethod({
      id: 3,
      requestEncoding: RPC.NULL,
      responseEncoding: messages.StatusResponse
    })
  }

  onRequest (context, handlers = context) {
    if (handlers.command) this._command.onrequest = handlers.command.bind(context)
    if (handlers.stream) this._stream.onrequest = handlers.stream.bind(context)
    if (handlers.status) this._status.onrequest = handlers.status.bind(context)
  }

  command (data) {
    return this._command.request(data)
  }

  commandNoReply (data) {
    return this._command.requestNoReply(data)
  }

  stream (data) {
    return this._stream.request(data)
  }

  streamNoReply (data) {
    return this._stream.requestNoReply(data)
  }

  status () {
    return this._status.request()
  }

  statusNoReply () {
    return this._status.requestNoReply()
  }
}

module.exports = class HRPCSession extends HRPC {
  constructor (rawSocket, { maxSize = 2 * 1024 * 1024 * 1024 } = {}) {
    super()

    this.rawSocket = rawSocket
    this.rawSocketError = null
    rawSocket.on('error', (err) => {
      this.rawSocketError = err
    })

    const rpc = new RPC({ errorEncoding, maxSize })
    rpc.pipe(this.rawSocket).pipe(rpc)
    rpc.on('close', () => this.emit('close'))
    rpc.on('error', (err) => {
      if ((err !== this.rawSocketError && !isStreamError(err)) || this.listenerCount('error')) this.emit('error', err)
    })

    this.collection = new HRPCServiceCollection(rpc)
    this.commands = new HRPCServiceCommands(rpc)
  }

  destroy (err) {
    this.rawSocket.destroy(err)
  }
}

function isStreamError (err) {
  return err.message === 'Writable stream closed prematurely' || err.message === 'Readable stream closed prematurely'
}

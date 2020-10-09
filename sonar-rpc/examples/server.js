const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const { Readable } = require('streamx')
const debug = require('debug')('sonar:rpc')

const HRPC = require('..')
const getNetworkOptions = require('../socket')

const SessionState = require('./session-state')

module.exports = class SonarRPC extends Nanoresource {
  constructor (opts = {}) {
    super()
    this.server = HRPC.createServer(this._onConnection.bind(this))
    this._socketOpts = getNetworkOptions(opts)
    this._collections = opts.collections
  }

  async _open () {
    await this.server.listen(this._socketOpts)
  }

  async _close () {
    await this.server.close()
  }

  _onConnection (client) {
    const sessionState = new SessionState()

    this.emit('client-open', client)

    client.on('close', () => {
      sessionState.deleteAll()
      this.emit('client-close', client)
    })

    client.commands.onRequest(new CommandsSession(client, sessionState))
    client.collection.onRequest(new CollectionSession(client, sessionState, this._collections))
  }
}

class CollectionSession {
  constructor (client, sessionState, collections) {
    this._client = client
    this._sessionState = sessionState
    this._collections = collections
  }

  async open (req) {
    const { id, key, name, token } = req
    if (this._sessionState.hasCollection(id)) throw new Error('Session already in use')
    const collection = await this._collections.get({ key, name })
    await collection.ready()
    // await new Promise((resolve, reject) => {
    //   collection.ready(err => err ? reject(err) : resolve())
    // })
    this._sessionState.addCollection(id, collection)
    const res = {
      key: collection.key,
      name: collection.name,
      total: collection.length
    }
    return res
  }

  async announce (req) {
    const { id, namespace, queries } = req
    const collection = this._sessionState.getCollection(id)
    for (const query of queries) {
      const { name, args } = query
      const queryname = namespace + '.' + name
      collection.registerQuery(queryname, {
        async query (args, opts) {
          const { live, stream } = opts
          const req = { name, args, live, stream }
          if (!opts.stream) {
            const res = await this._client.query(req)
            return res
          } else {
            const stream = new Readable()
            const resourceId = this._sessionState.createResourceId()
            req.resourceId = resourceId
            this._sessionState.addResource('@remotequery/' + resourceId)
            const _res = await this._client.query(req)
            return stream
          }
        }
      })
    }
  }

  async onResults (req) {
    const { resourceId, records, meta, finished } = req
    const query = this._sessionState.getResource('@remotequery/' + resourceId)
    for (const record of records) {
      query.push(record)
    }
    if (finished) {
      query.push(null)
    }
  }

  async query (req) {
    console.log('query', req)
    let { id, resourceId, name, args, stream, live } = req
    const collection = this._sessionState.getCollection(id)

    args = JSON.parse(args.toString())

    // Streaming queries
    if (stream) {
      const queryStream = collection.createQueryStream(name, args, { live })
      const dataListener = row => {
        this._client.onResultsNoReply({
          resourceId,
          records: [row],
          meta: {},
          finished: false
        })
      }
      const endListener = () => {
        this._client.onResultsNoReply({
          resourceId,
          records: [],
          meta: {},
          finished: true
        })
      }
      const errorListener = (err) => {
        this._client.onResultsNoReply({
          resourceId,
          records: [],
          meta: {},
          finished: true,
          error: {
            message: err.message,
            code: 0
          }
        })
      }
      queryStream.on('data', dataListener)
      queryStream.on('end', endListener)
      queryStream.on('error', errorListener)
      this._sessionState.addResource('@query/' + resourceId, queryStream, () => {
        queryStream.destroy()
      })
      return {}
    }

    // Non-streaming queries
    if (live) throw new Error('Live queries are only supported in streaming mode')
    console.log('now q')
    const records = await collection.query(name, args)
    console.log('res', records)
    // TODO: Proper encode step.
    const res = { records: [], meta: {} }
    for (let record of records) {
      record = record.toJSON()
      record.value = JSON.stringify(record.value)
      console.log('r', record)
      res.records.push(record)
    }
    console.log('query res')
    return res
  }

  async cancelQuery (req) {
    const { id, resourceId } = req
    this._sessionState.deleteResource('@query/' + resourceId)
  }

  async publish (req) {
    const { id, records } = req
    for (const record of records) {
      record.value = JSON.parse(record.value.toString())
    }
    console.log('publish', req)
    try {
      const collection = this._sessionState.getCollection(id)
      const res = await collection.publish(records[0])
      console.log('published', res)
      // TODO: Return actual links, not just ids.
      return { records: [{ key: res, seq: 0 }] }
      // return { records: links }
    } catch (err) {
      console.log('publish err', err)
      throw err
    }
  }

  async subscribe (req) {
    const { id, resourceId, persist, name, start, end, reverse } = req

    if (this._sessionState.hasResource('@sub/' + resourceId)) throw new Error('Resource id in use')

    const collection = this._sessionState.getCollection(id)

    const subscription = collection.createSubscription(name, {
      persist,
      start,
      end,
      reverse
    })

    const updateListener = () => {
      this._client.onUpdateNoReply({ id, resourceId })
    }
    this._sessionState.addResource('@sub/' + resourceId, subscription, () => {
      subscription.removeEventListener('update', updateListener)
    })

    return new Promise((resolve, reject) => {
      subscription.getState((err, state) => {
        if (err) return reject(err)
        resolve({
          cursor: state.indexedBlocks,
          total: state.totalBlocks
        })
      })
    })
    // const state = await subscription.getState()
    // return {
    //   cursor: state.cursor,
    //   total: state.total
    // }
  }

  async pull (req) {
    const { resourceId } = req
    const subscription = this._sessionState.getResource('@sub/' + resourceId)
    return new Promise((resolve, reject) => {
      subscription.pull((err, result) => {
        if (err) return reject(err)
        resolve({
          messages: result.messages,
          cursor: result.cursor,
          finished: result.finished,
          total: result.total
        })
      })
    })
    // const result = await subscription.pull()
    // return {
    //   messages: result.messages,
    //   cursor: result.cursor,
    //   finished: result.finished,
    //   total: result.total
    // }
  }

  async ack (req) {
    const { resourceId, cursor } = req
    const subscription = this._sessionState.getResource('@sub/' + resourceId)
    await subscription.ack(cursor)
    return {
      cursor,
      total: subscription.total
    }
  }

  async sync (req) {
    const { id, views } = req
    const collection = this._sessionState.getCollection(id)
    return new Promise((resolve, reject) => {
      collection.sync(views, err => {
        err ? reject(err) : resolve()
      })
    })
  }
}

const { spawn } = require('child_process')
class CommandsSession {
  constructor (client, sessionState) {
    this._client = client
    this._sessionState = sessionState
  }

  // RPC Methods

  async command (req) {
    const { resourceId, command, args, env } = req
    console.log('command', req)
    const stringArgs = args.map(arg => arg.value.toString())
    const subprocess = spawn(command, stringArgs)
    // const subprocess = spawn('node', ['demo.js'])
    this._sessionState.addResource('@proc/' + resourceId, subprocess, () => {
      subprocess.kill()
    })
    const stdoutListener = data => {
      debug('stdout', data.toString())
      this._client.commands.streamNoReply({
        resourceId,
        streamId: 0,
        data: data
      })
    }
    const stderrListener = data => {
      debug('stderr', data.toString())
      this._client.commands.streamNoReply({
        resourceId,
        streamId: 1,
        data: data
      })
    }
    subprocess.stdout.on('data', stdoutListener)
    subprocess.stderr.on('data', stderrListener)
    subprocess.on('close', (code, signal) => {
      this._client.commands.streamNoReply({
        resourceId,
        streamId: 0,
        finished: true
      })
    })
    return { value: 'ok' }
  }

  async stream (req) {
    debug('stream', req)
    const { resourceId, data, finished, error, code } = req
    // if (error) {
    //   this._sessionState.deleteResource(resourceId)
    //   return
    // }
    const proc = this._sessionState.getResource('@proc/' + resourceId)
    if (!proc) return
    proc.stdin.write(data)
    if (finished) proc.stdin.end()
  }
}

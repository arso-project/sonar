import base32Encode from 'base32-encode'
import type EventSource from '@frando/eventsource'
import randomBytes from '@frando/randombytes'
import Debug from 'debug'
import { Readable, Writable, Transform } from 'streamx'
import { EventEmitter } from 'events'
import { Schema, Store } from '@arsonar/common'
import { Files } from './files.js'
import type { Workspace } from './workspace.js'
import type { Logger, Record, RecordVersion, WireRecordVersion, RecordVersionForm, TypeSpecInput, SchemaSpec } from '@arsonar/common'
import { FetchOpts } from './fetch.js'

const debug = Debug('sonar-client')
function uuid() {
  return base32Encode(randomBytes(16), 'Crockford').toLowerCase()
}

export type Recordlike = Record | RecordVersion | WireRecordVersion | RecordVersionForm

export type GetRequest = {
  key: string
  seq: string
} | {
  type?: string
  id?: string
} | {
  lseq: number
}

export interface GetOpts {
  sync?: boolean
}

export interface CollectionInfo {
  id: string
  name: string
  key: string
  discoveryKey: string
  rootKey: string
  localKey: string
  length: number
  feeds: FeedInfo[]
  peers: any
  schema: SchemaSpec
}

export interface FeedInfo {
  key: string
  discoveryKey: string
  length: number
  byteLength: number
}

export class Collection extends EventEmitter {
  readonly opened: boolean = false
  readonly endpoint: string
  readonly workspace: Workspace
  readonly files: Files
  readonly log: Logger
  readonly schema: Schema
  readonly store: Store

  private _info: CollectionInfo | null
  private readonly _nameOrKey: string
  private _eventStream?: TeeStream | null
  private _eventSource?: EventSource
  private _length: number
  private readonly _cacheid?: string
  private _liveUpdates = false

  static uuid() {
    return uuid()
  }

  /**
     * Remote collection
     *
     * @constructor
     * @param workspace - Remote workspace
     * @param nameOrKey - Name or key of the collection
     */
  constructor(workspace: Workspace, nameOrKey: string, info: CollectionInfo) {
    super()

    this.endpoint = workspace.endpoint + '/collection/' + nameOrKey
    this.workspace = workspace
    this.files = new Files(this)
    this.log = workspace.log.child({ collection: this })
    this.setMaxListeners(256)
    this.schema = Schema.fromJSON(info.schema)
    this._info = info
    this.store = new Store({ schema: this.schema })
    this.opened = true

    this._info = info
    this._nameOrKey = nameOrKey
    this._length = 0
  }

  static async open (workspace: Workspace, nameOrKey: string) {
    const info = await workspace.fetch(`/collection/${nameOrKey}`)
    const self = new Collection(workspace, nameOrKey, info)
    return self
  }

  get name() {
    if (this._info) { return this._info.name }
    return this._nameOrKey
  }

  get key() {
    return this._info && this._info.key
  }

  get localKey() {
    return this._info && this._info.localKey
  }

  get info() {
    return this._info
  }

  get id() {
    return this._info && this._info.id
  }

  get length() {
    return this._length || this._info?.length || 0
  }

  /**
   * Update collection info and schema from endpoint.
   */
  async updateInfo () {
    const info: CollectionInfo = await this.fetch('/')
    this._info = info
    for (const type of Object.values(info.schema.types)) {
      this.schema.addType(type)
    }
  }

  /**
     * Close the collection.
     *
     * Properly closes open HTTP requests.
     * @async
     */
  async close() {
    // for (const stream of this._eventStreams) {
    //     stream.destroy();
    // }
    if (this._eventSource) { this._eventSource.close() }
  }

  /**
     * Put a new feed to the collection.
     *
     * @async
     * @param key - The hex-encoded key of the feed to add.
     * @param [info] - Optional information about the feed.
     *                          TODO: Document
     */
  async putFeed(key: string, info = {}) {
    return await this.fetch('/feed/' + key, {
      method: 'PUT',
      body: info
    })
  }

  /**
   * Put a new feed to the collection.
   *
   * @deprecated replaced with putFeed.
   */
  async addFeed(key: string, info = {}) {
    return await this.putFeed(key, info)
  }

  /**
     * Query the collection.
     *
     * Returns an array of matching records.
     *
     * Records may have a meta property that includes query-specific metadata (e.g. the score for search queries).
     *
     * @async
     * @param {string} name - The name of a supported query.
     *                        Supported queries that ship with @arsonar/core are:
     *                        records, search, relations, history and indexes.
     * @param {object} args - The arguments for the query. Depends on the query being used.
     *                        For records: `{ schema, name, id }`
     *                        For history: `{ from: timestamp, to: timestamp }`
     *                        For search: Either a "string" for a simple full-text search, or a
     *                           tantivy query object.
     *                        For indexes: `{ schema, prop, value, from, to, reverse, limit }`
     *                           (to be documented)
     *                        For relations: `{ subject, object, predicate }`
     *                           where subject and object are ids and predicate is `type#field`
     *
     * @param {object} [opts] - Optional options
     * @param {boolean} [opts.sync=false] Wait for all pending indexing operations to be finished.
     *
     * @return {Promise<Array<Record>>} A promise that resolves to an array of record objects.
     */
  async query(name: string, args: any, opts?: any): Promise<Record[]> {
    if (this._cacheid) {
      opts.cacheid = this._cacheid
    }
    const fetchedRecords = await this.fetch('/query/' + name, {
      method: 'POST',
      body: args,
      params: opts
    }) as WireRecordVersion[]
    const records = []
    for (const wireRecord of fetchedRecords) {
      try {
        records.push(this.store!.cacheRecord(wireRecord))
      } catch (err) {
        console.error('Error when upcasting record', err)
        console.error('Record: ', wireRecord)
      }
    }
    return records
  }

  /**
     * Put a new record into the collection.
     *
     * @async
     * @param {object} record - The record.
     * @param {string} record.schema - The schema of the record.
     * @param {string} [record.id] - The entity id of the record. If empoty an id will be created.
     * @param {object} record.value - Value of the record.
     * @throws Throws if the record is invalid.
     * @return {Promise<object>} An object with an `{ id }` property.
     */
  async put(record: RecordVersion | WireRecordVersion | RecordVersionForm): Promise<Record> {
    // If the record has no id set (= is a new record), generate and add a random id.
    // if (!record.id) { record.id = uuid() }
    // This checks if the record has type, id, value set and if the type is present
    // in the collection's schema. Throws an error if not.
    // TODO: Add feature to @arsonar/common to validate the record's value against the schema.
    record = this.schema!.RecordVersion(record)
    const resultRecord = await this.fetch('/', {
      method: 'POST',
      body: record.toJSON()
    })
    return this.store!.cacheRecord(resultRecord)
  }

  /**
     * Get records by their semantic address (type and id) or by their storage address (key and seq).
     *
     * @async
     * @param {object} req - The get request. Either `{ type, id }` or `{ key, seq }`.
     * @param {object} [opts] - Optional options.
     * @param {boolean} [opts.sync=false] Wait for all pending indexing operations to be finished.
     * @return {Promise<Array<object>>} A promise that resolves to an array of record objects.
     */
  async get(req: GetRequest, opts?: GetOpts): Promise<Record[]> {
    // TODO: Implement RecordCache.has
    // if (this._cache.has(req)) {
    //   return this._cache.get(req)
    // }
    return await this.query('records', req, opts)
  }

  /**
     * Get a specific version of a record.
     *
     * @async
     * @param {string} address - The block address of the record version `feedkey@seq`
     *    where `feedkey` is the hex-encoded public key of a feed and `seq` is a sequence number (uint).
     */
  async getVersion(address: string): Promise<Record> {
    const [key, seq] = address.split('@')
    const version = await this.fetch(`/db/${key}/${seq}`)
    return this.store!.cacheRecord(version)
  }

  /**
     * Deletes a record.
     *
     * @async
     * @param {object} record - The record to delete. Has to have `{ id, type }` properties set.
     * @return {Promise<object>} - An object with `{ id, type }` properties of the deleted record.
     */
  async del(record: Record | RecordVersion | WireRecordVersion): Promise<void> {
    return await this.fetch(`/record/${record.type}/${record.id}`, {
      method: 'DELETE'
    })
  }

  /**
     * Add a new type to the collection.
     *
     * @async
     * @param {object} schema - A schema object.
     * @throws Throws if the schema object is invalid or cannot be saved.
     * @return {Promise<object>} A promise that resolves to the saved schema object.
     */
  async putType(spec: TypeSpecInput) {
    const type = this.schema!.addType(spec)
    return await this.fetch('/schema', {
      method: 'POST',
      body: type.toJSON()
    })
  }

  /**
     * Create a writable stream to put records into the collection.
     *
     * Example:
     * ```javascript
     * const batchStream = collection.createBatchStream()
     * batch.write(record)
     * batch.close()
     * ```
     *
     * @return {Writable<Record>} A writable stream
     */
  createBatchStream(): Transform<Recordlike, string, string> & { finished: Promise<void> } {
    const self = this
    const stream: Transform<Recordlike, string, string> & { finished?: Promise<void> } = new Transform({
      open(cb) {
        cb()
      },
      transform(record, cb) {
        // if (!record.id) { record.id = uuid() }
        try {
          const recordVersion = self.schema!.RecordVersion(record)
          // record = self.store.cacheRecord(record)
          const json = JSON.stringify(recordVersion)
          this.push(json + '\n')
        } catch (err) {
          cb(err as Error)
        }
      },
      final(cb) {
        cb()
      }
    })
    stream.finished = this
      .fetch('/', {
        method: 'POST',
        requestType: 'stream',
        headers: {
          'content-type': 'application/x-ndjson'
        },
        params: { batch: true },
        body: stream
      })
      .catch(err => stream.destroy(err))
    return stream as Transform<Recordlike, string, string> & { finished: Promise<void> }
  }

  /**
     * Wait for all pending indexing operations to be finished.
     *
     * @async
     * @return {Promise<void>}
     */
  async sync() {
    return await this.fetch('/sync')
  }

  /**
     * Subscribe to events on this collection.
     *
     * Returns a readable stream that emits event objects.
     * They look like this:
     * `{ event: string, data: object }`
     *
     * Events are:
     *
     * * `update`: with data `{ lseq }`
     * * `feed`: with data `{ key }`
     * * `schema-update`
     *
     * @return {Readable<object>}
     */
  createEventStream(): Readable<any> {
    if (!this._eventStream) {
      this._initEventSource()
    }
    return this._eventStream!.subscribe()
  }

  private async _initEventSource() {
    if (this._eventStream) return
    this._eventStream = new TeeStream()
    const onerror = (_err: any) => {
      // TODO: Where should the error go?
      // this.log.error('Error initializing event source: ' + err.message)
      // if (this._eventStream) this._eventStream.destroy(err)
      // if (this._eventStream) this._eventStream.close()
      this._eventStream = null
    }
    try {
      if (!this.workspace.opened) { await this.workspace.open() }
    } catch (err) {
      onerror(err)
      return
    }
    this._eventSource = this.workspace.createEventSource('/events', {
      endpoint: this.endpoint,
      onerror,
      onmessage: (eventObject: any) => {
        this.log.trace('event: ' + eventObject.event)
        this._eventStream!.write(eventObject)
        this.emit(eventObject.event, eventObject.data)
      }
    })
  }

  /**
     * Pull live updates from the server as they happen.
     *
     * After calling this method once, all new records and record versions
     * are pulled from the server once available. The `update` event
     * is emitted when new records are about to arrive.
     */
  pullLiveUpdates() {
    if (this._liveUpdates) { return }
    this._liveUpdates = true
    const eventStream = this.createEventStream()
    eventStream.on('data', event => {
      if (event.event !== 'update') { return }
      const lseq = event.data.lseq
      if (!lseq || lseq < this.length) { return }
      const oldLength = this.length
      this._length = lseq + 1
      for (let i = oldLength + 1; i < this.length; i++) {
        this.get({ lseq: i }).catch(_e => { })
      }
      this.emit('update', lseq)
    })
  }

  /**
     * Subscribe to this collection.
     *
     * This will fetch all records from the first to the last and then waits for new records.
     * Currently only intended for usage in bots (not in short-running Browser clients).
     *
     * @todo: Prefix client ID to subscription name.
     * @todo: Allow to subscribe from now instead of from the beginning.
     *
     * @param {string} Subscription name. Has to be unique per running Sonar instance
     * @param {function} Async callback function that will be called for each incoming record
     */
  async subscribe(name: string, onRecord: (record: Record) => Promise<void>) {
    const self = this
    await this._initEventSource()
    run().catch(err => {
      // TODO: How to deal with these errors?
      this.log.error('subscription error', err)
    })
    return true
    async function run() {
      // const eventStream = self.createEventStream()
      while (true) {
        // wait for one incoming update event
        const nextUpdatePromise = new Promise((resolve, _reject) => {
          self.once('update', resolve)
        })
        const batch = await self._pullSubscription(name)
        for (const message of batch.messages) {
          try {
            const record = self.store!.cacheRecord(message)
            await onRecord(record)
            // TODO: Do we want to ack for each message or for each batch?
            // Likely let the subscriber decide.
            await self._ackSubscription(name, message.lseq)
          } catch (err) {
            // TODO: What to do with errors here?
            self.log.error(`Error in subscription ${name}: ${(err as Error).message}`)
            debug(err)
            // TODO: This will easily cause an endless loop becaues it'll
            // just keep refreshing and running into errors ;-)
          }
        }
        if (batch.finished) {
          await nextUpdatePromise
        }
      }
    }
  }

  private async _pullSubscription(name: string, opts?: any) {
    // TODO: Prefix name with client id.
    return await this.fetch('/subscription/' + name, {
      params: opts
    })
  }

  private async _ackSubscription(name: string, cursor: number) {
    // TODO: Prefix name with client id.
    return await this.fetch('/subscription/' + name + '/' + cursor, {
      method: 'post'
    })
  }

  /**
     * Reindex the secondary indexes (views) in this collection.
     *
     * Use with care, this can be expensive.
     *
     * @param {Array<string>} Optional array of view names to reindex.
     *  If unset all views will be reindexed.
     */
  async reindex(views?: string[]) {
    const params: any = {}
    if (views) params.views = views 
    return await this.fetch('/reindex', {
      method: 'post',
      params
    })
  }

  async fetch(path: string, opts: FetchOpts = {}) {
    if (!opts.endpoint) { opts.endpoint = this.endpoint }
    return await this.workspace.fetch(path, opts)
  }
}

class TeeStream extends Writable {
  _streams: Set<Readable>
  constructor(opts?: any) {
    super(opts)
    this._streams = new Set()
  }

  subscribe(opts?: any): Readable {
    const stream = new Readable(opts)
    // @ts-expect-error
    stream.on('destroy', (_: any) => this._streams.remove(stream))
    this._streams.add(stream)
    return stream
  }

  _write(data: any, cb: any) {
    for (const stream of this._streams) {
      stream.push(data)
    }
    cb()
  }

  _destroy(err: any) {
    for (const stream of this._streams) {
      stream.destroy(err)
    }
    super.destroy(err)
  }
}

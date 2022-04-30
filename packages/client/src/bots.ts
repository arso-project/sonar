import { Logger } from '@arsonar/common'
import type EventSource from 'eventsource'
import Debug from 'debug'
import type { Workspace } from './workspace'
import { FetchOpts } from './fetch'
import { Collection } from './collection'
import type { Record, TypeSpec } from '@arsonar/common'

const debug = Debug('sonar:bots')
const SESSION_HEADER = 'X-Sonar-Bot-Session-Id'

interface Reply {
  requestId: string
  error?: any
  result?: any
}
interface BotMessage {
  bot: string
  op: string
  data?: any
  requestId: string
}

export type BotConfig = any
export type BotSpec = {
  name?: string,
  types: TypeSpec[]
}

export type BotHandlersInit = ((opts : BotHandlersInitArgs) => BotHandlers) | BotHandlers
export type BotHandlersInitArgs = {
  spec: BotSpec,
  config: BotConfig,
  workspace: Workspace
}

type BotInitArgs = BotHandlersInitArgs & {
  handlers: BotHandlersInit
}

export interface BotHandlers {
  open?: () => Promise<void> | void
  onjoin: (collection: Collection, config: any) =>  Promise<BotSession>
  oncommand?: (command: string, args: any) => Promise<any>
}

export interface BotSession {
  open?: () => Promise<void> | void
  close?: () => Promise<void> | void
  oncommand: (command: string, args: any) => Promise<any>
  onrecord?: (record: Record) => Promise<void>
}

export class Bots {
  private workspace: Workspace
  private bots: Map<string, Bot>
  private log: Logger
  private _eventSource?: EventSource
  private _init?: boolean
  private _sessionId?: string
  constructor (workspace: Workspace) {
    this.workspace = workspace
    this.bots = new Map()
    this.log = this.workspace.log.child({ name: 'bots' })
  }

  async close () {
    if (this._eventSource) this._eventSource.close()
  }

  async join (botName: string, collection: string) {
    const res = await this.fetch('/join', {
      method: 'POST',
      body: { bot: botName, collection }
    })
    return res
  }

  async leave (botName: string, collection: string) {
    const res = await this.fetch('/leave', {
      method: 'POST',
      body: { bot: botName, collection }
    })
    return res
  }

  async info () {
    const res = await this.fetch('/info')
    return res
  }

  async command (botName: string, command: string, args: any, env: any) {
    const path = '/command'
    const res = await this.fetch(path, {
      method: 'POST',
      body: { bot: botName, command, args, env }
    })
    return res
  }

  async commandStatus (botName: string, requestId: string) {
    const path = `/status/${botName}/${requestId}`
    const res = await this.fetch(path)
    return res
  }

  async getCommands () { }
  private async _initListener () {
    this._init = true
    const path = '/bot/events'
    this._eventSource = this.workspace.createEventSource(path, {
      headers: this.getHeaders(),
      onmessage: this._onmessage.bind(this),
      onerror: (err: any) => {
        // TODO: Where do these errors go?
        // TODO: After a couple of fails die.
        this.log.error({ err, message: 'Event source error' })
      }
    })
  }

  private async reply ({ requestId, error, result }: Reply): Promise<any> {
    await this.fetch('/reply', {
      method: 'POST',
      body: {
        requestId,
        error,
        result
      }
    })
  }

  private async _onmessage (message: any) {
    try {
      const { bot: name, op, data, requestId } = message
      const bot = this.bots.get(name)
      if (!bot) throw new Error('Unknown bot: ' + bot)
      try {
        if (op === 'join') {
          const { collection: collectionKey } = data
          const collection = await this.workspace.openCollection(collectionKey)
          await bot.onjoin(collection, data.config)
          await this.reply({ requestId })
        } else if (op === 'leave') {
          const { collection: collectionKey } = data
          const collection = await this.workspace.openCollection(collectionKey)
          await bot.onleave(collection)
          await this.reply({ requestId })
        } else if (op === 'command') {
          const { command, args, env } = data
          if (env.collection) {
            env.collection = await this.workspace.openCollection(env.collection)
          }
          const result = await bot.oncommand(command, args, env)
          await this.reply({ requestId, result })
        }
      } catch (err) {
        console.error(err)
        // this.log.error({ message: 'bot onmessage handle error: ' + err.message + ' from ' + JSON.stringify(message), err })
        this.log.error({
          message: 'bot onmessage handle error: ' + (err as Error).message,
          err
        })
        debug(err)
        await this.reply({
          requestId: requestId,
          error: (err as Error).message
        })
      }
    } catch (err) {
      // TODO: Where to these errors go?
      this.log.error({ message: 'bot onmessage error', err })
      console.error(err)
    }
  }

  private getHeaders () {
    const headers: globalThis.Record<string, string> = {}
    if (this._sessionId) {
      headers[SESSION_HEADER] = this._sessionId
    }
    return headers
  }

  private async fetch (url: string, opts: FetchOpts = {}) {
    url = '/bot' + url
    opts.headers = opts.headers || {}
    opts.headers = { ...this.getHeaders(), ...opts.headers }
    return await this.workspace.fetch(url, opts)
  }

  async register (name: string, spec: BotSpec, handlers: BotHandlersInit) {
    if (typeof spec !== 'object') { throw new Error('Spec must be an object') }
    spec.name = name
    const { config, sessionId } = await this.fetch('/register', {
      method: 'POST',
      body: spec
    })
    this._sessionId = sessionId
    if (!this._init) { await this._initListener() }
    this.bots.set(name, new Bot({
      spec,
      workspace: this.workspace,
      config,
      handlers
    }))
  }
}

class Bot {
  private spec: BotSpec 
  private name: string
  private workspace: Workspace
  private config: any
  private handlers: BotHandlers 
  private opened: boolean
  private log: Logger
  private opening: any
  private sessions: Map<string, BotSession>
  constructor ({ spec, config, handlers, workspace }: BotInitArgs) {
    this.spec = spec
    this.name = spec.name!
    this.workspace = workspace
    this.config = config
    if (typeof handlers === 'function') {
      handlers = handlers({ spec, config, workspace })
    }
    this.handlers = handlers
    this.sessions = new Map()
    this.opened = false
    this.log = this.workspace.log.child({ name: 'bot:' + this.name })
  }

  async open () {
    if (this.opened) { return }
    if (this.opening) { return this.opening }
    let _resolve
    this.opening = new Promise(resolve => (_resolve = resolve))
    if (this.handlers.open) { await this.handlers.open() }
    // @ts-expect-error
    _resolve()
    this.opened = true
    this.log.debug('open')
  }

  async onjoin (collection: Collection, config: any) {
    await this._ensureTypes(collection)
    await this.open()
    if (!this.opened && this.handlers.open) {
      await this.handlers.open()
      this.opened = true
    }
    const session = await this.handlers.onjoin(collection, config || this.config)
    if (session.open) {
      await session.open()
    }
    if (session.onrecord) {
      collection.subscribe('bot:' + this.name, session.onrecord.bind(session))
    }
    this.sessions.set(collection.key as string, session)
    this.log.debug({ message: 'join', collection })
  }

  private async _ensureTypes (collection: Collection) {
    if (!this.spec.types) { return }
    for (const typeSpec of this.spec.types) {
      if (!collection.schema!.hasType(typeSpec.address)) {
        await collection.putType(typeSpec)
      }
    }
  }

  async onleave (collection: Collection) {
    if (!collection.key) throw new Error('Collection not opened')
    const session = this.sessions.get(collection.key)
    if (!session) { return }
    if (session.close) { await session.close() }
    this.sessions.delete(collection.key)
    this.log.debug({ message: 'leave', collection })
  }

  async oncommand (command: string, args: any, env: any) {
    await this.open()
    if (!env.collection && this.handlers.oncommand) {
      this.log.debug('workspace command: ' + command)
      return await this.handlers.oncommand(command, args)
    }
    this.log.debug({
      message: 'collection command: ' + command,
      collection: env.collection
    })
    const session = this.sessions.get(env.collection.key)
    if (!session) { throw new Error('Bot did not join collection') }
    if (!session.oncommand) { throw new Error('Bot cannot handle commands') }
    return await session.oncommand(command, args)
  }
}

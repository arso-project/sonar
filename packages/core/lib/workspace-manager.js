const { NanoresourcePromise: Nanoresource } = require('nanoresource-promise/emitter')
const { promisify } = require('util')
const mkdirp = promisify(require('mkdirp-classic'))
const DatSDK = require('hyper-sdk')
const p = require('path')
const RAF = require('random-access-file')
const RAM = require('random-access-memory')
const createLogger = require('@arsonar/common/log')

const { defaultStoragePath } = require('./util')

const Workspace = require('./workspace')

module.exports = class WorkspaceManager extends Nanoresource {
  constructor (opts = {}) {
    super()
    this.opts = opts
    this.workspaces = new Map()
    this.log = opts.log || createLogger()
    this._storagePath = opts.storagePath || defaultStoragePath(opts)
  }

  storagePath (name) {
    return p.join(this._storagePath, name)
  }

  async getWorkspace (name, opts) {
    if (!name) throw new Error('Invalid workspace name')
    if (!this.opened) await this.open()
    let workspace
    if (this.workspaces.has(name)) workspace = this.workspaces.get(name)
    else workspace = this._getWorkspace(name, opts)
    if (!workspace.opened) await workspace.open()
    return workspace
  }

  _getWorkspace (name, opts) {
    const storagePath = this.storagePath('workspace/' + name)
    const workspace = new Workspace({
      // id: deriveId(name),
      id: name,
      ...this.opts,
      ...opts,
      log: this.log,
      sdk: this.sdk,
      storagePath
    })
    this.workspaces.set(name, workspace)
    return workspace
  }

  async _open () {
    await mkdirp(this.storagePath(''))
    if (!this.opts.sdk) {
      const sdkOpts = {
        ...this.opts,
        swarmOpts: this.opts.swarm || this.opts.swarmOpts
      }
      if (this.opts.persist === false) {
        sdkOpts.storage = RAM
      } else {
        sdkOpts.storage = file => RAF(this.storagePath('cores/' + file))
      }
      this.sdk = await DatSDK(sdkOpts)
      this.ownSDK = true
    } else {
      this.sdk = this.opts.sdk
      this.ownSDK = false
    }
  }

  async _close () {
    if (!this.opened) await this.open()
    for (const workspace of this.workspaces.values()) {
      await workspace.close()
    }
    if (this.ownSDK) {
      await this.sdk.close()
    }
    this.emit('close')
  }
}

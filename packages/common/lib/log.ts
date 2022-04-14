import pino, {Level} from 'pino'
import type { Logger, LoggerOptions, WriteFn } from 'pino'
import type { Color } from 'chalk'
import chalk from 'chalk'
/* @ts-ignore */
import prettyHash from 'pretty-hash'
import prettyBytes from 'pretty-bytes'
const isBrowser = process.title === 'browser'
function getLogLevel () {
  if (isBrowser) {
    return window.localStorage.getItem('LOG') || 'info'
  } else {
    return process.env.SONAR_LOG || process.env.LOG || 'info'
  }
}

function browserWrite (obj: object): void {
  let method = convertLogNumber(obj)?.name
  if (method === 'fatal') { method = 'error' }
  if (method === 'trace') { method = 'debug' }
  /* @ts-ignore */
  if (method && !console[method]) { method = 'log' }
  const prettified = prettify(obj)
  /* @ts-ignore */
  console[method](prettified)
}

function createPrettifier () {
  return prettify
}

function prettify (obj: any) {
  const trace = !!process.env.ERROR_TRACE ||
        process.env.LOG === 'debug' ||
        process.env.LOG === 'trace' ||
        false
  const opts = {
    trace,
    date: true,
    raw: false
  }
  if (opts.raw) { return obj }
  if (typeof obj === 'string') {
    obj = { message: obj }
  }
  if (!obj.message && obj.msg) { obj.message = obj.msg }
  if (obj.err) { obj.error = obj.err }
  const sp = ' '
  const date = formatDate()
  const level = formatLevel(obj)
  if (obj.error && typeof obj.error === 'object' && obj.error.message) {
    if (obj.message) { obj.message += chalk.gray(' (' + obj.error.message + ')') } else { obj.message = obj.error.message }
  }
  let out = '['
  if (date) { out += date + sp }
  out += level
  if (obj.name) { out += sp + chalk.gray(obj.name) }
  if (obj.namespace) { out += sp + chalk.gray(obj.namespace) }
  if (obj.collection) { out += sp + chalk.blue(collectionLabel(obj.collection)) }
  out += '] '
  if (obj.res && obj.req) { out += formatHttp(obj) + sp }
  out += obj.message
  if (obj.record) { out += sp + formatRecord(obj.record) }
  if (opts.trace && obj.error) { out += formatTrace(obj.error) }
  return out + '\n'
}

function formatDate () {
  const date = new Date()
  const z = date.getTimezoneOffset() * 60 * 1000
  const dateLocal = new Date(date.getTime() - z)
  return dateLocal.toISOString().substring(0, 19)
}

function formatTrace (error: Error) {
  if (!error.stack) { return '' }
  let out = '\n'
  out += JSON.parse(JSON.stringify(error.stack))
    .split('\n')
    .slice(1)
    .join('\n')
  return out
}

function formatRecord (record: any) {
  let out = ''
  out += chalk.blue.bold(record.id)
  out += ' ' + chalk.blue(record.type)
  const seq = record.seq || '?'
  out += ' ' + chalk.gray(`${prettyHash(record.key)}@${seq}`)
  return chalk.blue('Record(') + out + chalk.blue(')')
}
function collectionLabel (collection: any) {
  return (collection._keyOrName ||
        collection.name ||
        (collection.key && prettyHash(collection.key)) ||
        '<unknown>')
}

function formatLevel (obj: any) {
  const { name, color } = convertLogNumber(obj) as any
  /* @ts-ignore */
  let format = chalk[color]
  /* @ts-ignore */
  if (obj.level >= 40) { format = chalk[color].bold }
  return format(name.toUpperCase())
}

function formatHttp (obj: any) {
  if (!obj.res) { return }
  const { res, req } = obj
  let color: typeof Color
  if (res.statusCode > 200) { color = 'red' } else { color = 'green' }
  let out = ''
  out += chalk.bold(req.method)
  out += ' ' + req.url
  out += ' ' + chalk.gray(obj.responseTime + 'ms')
  out += ' ' + chalk[color].bold(res.statusCode)
  const size = res.headers['content-length']
  if (size) { out += ' ' + chalk.gray(prettyBytes(Number(size)).replace(' ', '')) }
  return out
}
function convertLogNumber (obj: any): { name: Level, color: typeof Color } | undefined {
  if (obj.level === 10) { return { name: 'trace', color: 'gray' } }
  if (obj.level === 20) { return { name: 'debug', color: 'gray' } }
  if (obj.level === 30) { return { name: 'info', color: 'green' } }
  if (obj.level === 40) { return { name: 'warn', color: 'yellow' } }
  if (obj.level === 50) { return { name: 'error', color: 'red' } }
  if (obj.level === 60) { return { name: 'fatal', color: 'red' } }
}
export default function createLogger (opts: LoggerOptions): Logger {
  const defaultOpts: LoggerOptions = {
    level: getLogLevel(),
    prettifier: createPrettifier,
    browser: {
      write: browserWrite
    }
  }
  if (!process.env.SONAR_LOG_JSON) { defaultOpts.prettyPrint = {} }
  const logger = pino({
    ...defaultOpts,
    ...opts
  })
  return logger
}
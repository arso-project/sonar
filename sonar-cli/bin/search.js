const makeClient = require('../client')
const table = require('text-table')
const chalk = require('chalk')
const ansi = require('ansi-styles')
const util = require('util')

exports.command = 'search <query>'
exports.describe = 'make search queries'
exports.handler = search
exports.builder = {
  full: {
    boolean: true,
    alias: 'f',
    describe: 'long output'
  }
}

async function search (argv) {
  const client = makeClient(argv)
  const query = argv.query
  const results = await client.search(query)
  const formatted = formatResults(results, argv)
  console.log(formatted)
}

function formatResults (results, opts) {
  const len = results.length
  let list
  if (!opts.full) {
    list = table(results.map(r => {
      return [
        r.value.score,
        formatSchema(r),
        r.id,
        chalk.bold.yellow(r.value.title)
      ]
    }))
  } else {
    list = results.map(formatResultFull).join('\n\n')
  }
  return `${len} total\n${list}`
}

function formatResultFull (r) {
  return [
    chalk.bold.green(r.value.title),
    '  ' + formatMeta(r),
    formatValue(r),
  ].join('\n')
}

function formatMeta (r) {
  const line = [
    'schema',
    chalk.bold(formatSchema(r)),
    'id',
    chalk.bold(r.id),
    'source',
    chalk.bold(r.source.substring(0, 6) + '..'),
  ].join(' ')
  return line
  // return chalk.dim(line)
  // return chalk.yellow(line)
}

function formatValue (r) {
  let snippet = r.value.snippet
  snippet = snippet.replace('<b>', ansi.yellow.open)
  snippet = snippet.replace('</b>', ansi.yellow.close)
  return snippet
}

function formatSchema (r) {
  const parts = r.schema.split('/')
  if (parts.length > 1) return parts[1]
  else return r.schema
}

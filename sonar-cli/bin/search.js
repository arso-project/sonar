const makeClient = require('../client')
const table = require('text-table')
const chalk = require('chalk')
const ansi = require('ansi-styles')
const util = require('util')
const prettyHash = require('pretty-hash')

exports.command = 'search <query>'
exports.describe = 'make search queries'
exports.handler = search
exports.builder = {
  full: {
    boolean: true,
    alias: 'f',
    describe: 'long output'
  },
  json: {
    boolean: true,
    alias: 'j',
    describe: 'output as json'
  },
  pretty: {
    boolean: true,
    describe: 'pretty-print json'
  }
}

async function search (argv) {
  const client = makeClient(argv)
  const query = argv.query
  const results = await client.search(query)
  if (argv.json) {
    console.log(JSON.stringify(results, 0, 2))
  } else {
    const formatted = formatResults(results, argv)
    console.log(formatted)
  }
}

function formatResults (results, opts) {
  const len = results.length
  let list
  if (!opts.full) {
    const rows = results.map(r => {
      return [
        r.meta.score || 0,
        formatType(r),
        r.id,
        chalk.bold.yellow(r.getOne('title'))
      ]
    })
    list = table(rows)
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
    'type',
    chalk.bold(formatType(r)),
    'id',
    chalk.bold(r.id),
    'feed',
    chalk.bold(prettyHash(r.key))
  ].join(' ')
  return line
  // return chalk.dim(line)
  // return chalk.yellow(line)
}

function formatValue (r) {
  let snippet = r.meta.snippet
  snippet = snippet.replace('<b>', ansi.yellow.open)
  snippet = snippet.replace('</b>', ansi.yellow.close)
  return snippet
}

function formatType (r) {
  return r.getType().title
  // const parts = r.schema.split('/')
  // if (parts.length > 1) return parts[1]
  // else return r.schema
}

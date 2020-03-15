const fs = require('fs')
const p = require('path')
const u = require('util')
const chalk = require('chalk')
const makeClient = require('../client')
const pretty = require('pretty-bytes')
const table = require('text-table')
const date = require('date-fns')
const mime = require('mime-types')
const speedometer = require('speedometer')
const yargs = require('yargs')

exports.command = 'fs'
exports.describe = 'file system'
exports.handler = () => yargs.showHelp()
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'list',
      describe: 'list drives',
      handler: list
    })
    .command({
      command: 'read <path>',
      describe: 'read file to stdout',
      handler: readfile
    })
    .command({
      command: 'read-id <id>',
      describe: 'read file by id to stdout',
      handler: readid
    })
    .command({
      command: 'write <path>',
      describe: 'write file from stdin',
      handler: writefile
    })
    .command({
      command: 'ls [path]',
      describe: 'list dir',
      builder: {
        list: {
          alias: 'l',
          boolean: true,
          describe: 'list mode'
        }
      },
      handler: ls
    })
    .command({
      command: 'import [path]',
      describe: 'import a file or folder',
      handler: importfile,
      builder: {
        prefix: {
          alias: 'p',
          describe: 'prefix path (default: import)',
          default: 'import'
        },
        scoped: {
          alias: 's',
          boolean: true,
          describe: 'prefix the filename with a new uniqe id'
        },
        force: {
          alias: 'f',
          boolean: true,
          describe: 'force overwrite'
        },
        update: {
          alias: 'u',
          boolean: true,
          describe: 'overwrite if existing and update resource'
        },
        recursive: {
          alias: 'r',
          boolean: true,
          describe: 'import directories (recursively)'
        }
      }
    })
}

async function list (argv) {
  const client = makeClient(argv)
  const list = await client.getDrives()
  console.log(list)
}

async function ls(argv) {
  const client = makeClient(argv)
  const path = argv.path || '/'
  const list = await client.statFile(path)
  let res
  if (!Array.isArray(list)) {
    list.name = p.basename(path)
    res = formatStat([list], { ...argv, details: true })
  } else {
    res = formatStat(list, argv)
  }
  console.log(res)
}

async function readid (argv) {
  const client = makeClient(argv)
  const id = argv.id
  console.error('reading ' + id)
  const res = await client.get({ id, schema: 'sonar/resource' })
  if (!res.length) throw new Error('id not found')
  if (res.length > 1) return console.error('warn: multiple files found. reading first')
  const rs = await client.readResourceFile(res[0])
  rs.pipe(process.stdout)
}

async function readfile (argv) {
  const client = makeClient(argv)
  const path = argv.path
  const res = await client.readFile(path)
  res.pipe(process.stdout)
}

async function writefile(argv) {
  const client = makeClient(argv)
  const path = argv.path
  const res = await client.writeFile(path, process.stdin)
  console.log(res)
}

async function importfile(argv) {
  const client = makeClient(argv)
  const path = p.resolve(argv.path)

  const writable = await client.isWritable()
  if (!writable) throw new Error('group is not writable')

  return _importfile({ client, path, opts: argv })
}

async function _importfile ({ client, path, opts }) {
  // const opts = {
  //   force: argv.force,
  //   update: argv.update,
  //   prefix: argv.prefix,
  //   scoped: argv.scoped,
  //   recursive: argv.recursive
  // }
  const stat = await pify(fs.stat, path)
  if (stat.isDirectory()) {
    if (opts.recursive) return _importfolder({ client, path, stat, opts })
    else throw new Error('path is a folder and recursive is not set')
  }
  let filename = p.basename(path)
  const record = await client.createResource({
    filename,
    prefix: opts.prefix,
    encodingFormat: mime.lookup(filename),
    contentSize: stat.size
  }, opts)

  console.log('created resource: ' + record.id)
  console.log('starting upload (' + pretty(stat.size) + ')')
  let readStream = fs.createReadStream(path)
  reportProgress(readStream, { msg: 'Uploading', total: stat.size })
  await client.writeResourceFile(record, readStream)
  console.log('ok')
}

async function _importfolder ({ client, path, opts }) {
  const stat = await pify(fs.stat, path)
  if (!stat.isDirectory()) throw new Error('not a directory')
  const filenames = await pify(fs.readdir, path)
  let prefix = p.basename(path)
  if (opts.prefix) prefix = p.join(opts.prefix, prefix)
  for (const filename of filenames) {
    const filepath = p.join(path, filename)
    console.log('importing: ' + filepath)
    try {
      await _importfile({ client, path: filepath, opts: { ...opts, prefix } })
      console.log('ok')
    } catch (e) {
      console.error(e.message)
    }
  }
  console.log(prefix)
}

function reportProgress (stream, { total, msg, bytes = true, interval = 1000 }) {
  let len = 0
  if (msg) msg = msg + ' ... '
  else msg = ''
  let report = setInterval(status, interval)
  stream.on('data', d => (len = len + d.length))
  stream.on('end', stop)
  function status() {
    if (!total) console.log(`${msg} ${pretty(len)}`)
    else {
      let percent = Math.round((len / total) * 100)
      console.log(`${msg} ${percent}% ${pretty(len)}`)
    }
  }
  function stop() {
    clearInterval(report)
    status()
  }
}

function formatStat(files, opts = {}) {
  opts = {
    list: false,
    ...opts
  }
  if (!files.length) return ''
  files = files.map(file => {
    return file
  })

  const rows = files.map(file => {
    const { name } = file
    file.stat = parseStat(file)
    if (file.stat.isDirectory()) file.name = chalk.bold.blueBright(name)
    file.size = pretty(file.size)
    file.mtime = formatDate(file.mtime)
    file.ctime = formatDate(file.ctime)
    return file
  })

  if (opts.details) {
    return rows.map(formatStatDetails).join('\n\n')
  }
  if (!opts.list) {
    return rows.map(f => f.name).join(' ')
  } else {
    const list = table(rows.map(f => ([f.size, f.mtime, f.name])))
    return `total ${rows.length}\n${list}`
  }
}

function formatStatDetails(file, opts = {}) {
  return formatList({
    filename: file.name,
    directory: file.stat.isDirectory(),
    size: file.size,
    modified: file.mtime,
    created: file.ctime,
    mount: file.mount,
    metadata: file.metadata
  })
}

function formatList(list) {
  let rows = Object.entries(list)
  rows = rows.map(([key, value]) => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      value = u.inspect(value)
    }
    return [chalk.dim(key), value]
  })
  return table(rows)
}

function formatDate (d) {
  if (typeof d === 'string') d = date.parseISO(d)
  if (date.differenceInYears(new Date(), d)) {
    return date.format(d, 'dd. MMM yyyy')
  } else {
    return date.format(d, 'dd. MMM HH:mm')
  }
}

function parseStat(s) {
  const { Stats } = require('fs')
  return new Stats(s.dev, s.mode, s.nlink, s.uid, s.gid, s.rdev, s.blksize,
    s.ino, s.size, s.blocks, s.atime, s.mtime, s.ctime)
}

function pify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, onresult)
    function onresult(err, data) {
      err ? reject(err) : resolve(data)
    }
  })
}

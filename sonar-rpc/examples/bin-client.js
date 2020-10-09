const { Client } = require('./index.js')
const debug = require('debug')('cli')

const { Writable } = require('streamx')

main().catch(onerror)

async function main () {
  const sonar = new Client()
  const name = 'demo'
  const collection = await sonar.collections.get({ name })
  console.log('collection key ' + collection.key)
  const record = {
    id: 'sonar/foo@0',
    type: 'sonar/type',
    value: {
      name: 'foo',
      namespace: 'sonar',
      title: 'Foo',
      version: 0,
      fields: {
        title: {
          type: 'string',
          title: 'Title',
          index: {
            basic: true
          }
        }
      }
    }
  }

  let res = await collection.publish([record])
  console.log('publish res', res)

  res = await collection.publish([{
    id: 'asdf',
    type: 'sonar/foo',
    value: {
      title: 'hello world'
    }
  }])
  console.log('publish res', res)

  console.log('now q')
  const qr = await collection.query('records', { type: 'sonar/foo' })
  console.log('qr', qr)
}

async function commands () {
  const sonar = new Client()
  const command = process.argv[2]
  // const args = ['/home/bit/demo.mkv']
  const args = process.argv.slice(3)
  console.log(command, args)
  const cmd = await sonar.commands.command(command, args)
  const closePromise = new Promise((resolve, reject) => {
    cmd.once('close', () => {
      resolve()
    })
  })
  process.stdin.on('data', data => {
    debug('stdin', data.toString())
    // cmd.stdin.write(data)
  })
  // process.stdin.pipe(cmd.stdin)
  cmd.stdout.pipe(process.stdout)
  cmd.stderr.pipe(process.stderr)
  cmd.stdout.on('data', data => {
    debug('stdout', data.toString())
  })
  cmd.stderr.on('data', data => {
    debug('stderr', data.toString())
  })
  await closePromise
  await sonar.close()
  // await new Promise((resolve, reject) => {
  //   cmd.stdout.on('close', resolve)
  //   cmd.stdout.on('error', reject)
  // })
}

function onerror (err) {
  console.error(err.stack)
  process.exit(1)
}

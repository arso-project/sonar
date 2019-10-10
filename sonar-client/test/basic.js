const test = require('tape-plus')
const tmp = require('temporary-directory')
require('axios-debug-log')

const createServer = require('@arso-project/sonar-server')
const SonarClient = require('..')

test('basics', async t => {
  const port = 21212
  const islandName = 'foo'

  const cleanup = await makeServer({ port })
  try {
    const client = new SonarClient(`http://localhost:${port}/api`, islandName)

    await client.create(islandName)
    await client.put({ schema: 'doc', value: { title: 'hello world' } })
    await client.put({ schema: 'doc', value: { title: 'hello moon' } })
    await new Promise(resolve => setTimeout(resolve, 500))
    let results = await client.search('hello')
    t.equal(results.length, 2, 'hello search')
    results = await client.search('world')
    t.equal(results.length, 1, 'world search')
    results = await client.search('moon')
    t.equal(results.length, 1, 'moon search')
  } catch (e) {
    t.error(e)
  }

  await cleanup()
})

function makeServer (opts = {}) {
  return new Promise((resolve, reject) => {
    tmp((err, dir, cleanup) => {
      if (err) return reject(err)

      opts.storage = dir
      opts.port = opts.port || 21212
      opts.logger = false

      const server = createServer(opts)
      server.listen(opts.port)
      const shutdown = () => new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) console.error('Error closing server.')
          cleanup(err => {
            if (err) reject(err)
            else resolve()
          })
        })
      })
      resolve(shutdown)
    })
  })
}

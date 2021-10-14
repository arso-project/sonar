const { Workspace } = require('.')
const url = 'http://localhost:9191/api/v1/default'
const workspace = new Workspace({ url })

;(async () => {
  const collection = await workspace.createCollection('foobar')
  await collection.put({
    type: 'sonar/entity',
    value: { label: 'hello world' }
  })
  const records = await collection.query('records', { type: 'sonar/entity' })
  console.log(records)
})()

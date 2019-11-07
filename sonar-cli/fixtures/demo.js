module.exports = { putFixtures }

async function putFixtures (client) {
  const schema = {
    properties: {
      title: { type: 'string', title: 'Title' },
      body: { type: 'string', title: 'Body' },
      date: { type: 'string', format: 'date-time', title: 'Published' }
    }
  }
  const record = {
    schema: 'doc',
    value: {
      title: 'Hello world',
      body: 'This is another Sonar demo',
      date: new Date()
    }
  }
  const res = await client.putSchema('doc', schema)
  console.log('putSchema', res)
  const id = await client.put(record)
  console.log('put', id)
}

const SonarClient = require('../index')

const client = new SonarClient('http://localhost:9191', '54d722bf355f5182931a59a9375dd0cd84883fae5acdfc4d568ace8d42c82fca')
client.get('doc', 'YiGVbMKE').then(res => console.log(res.data))
// create new island
client.create('newIsland')
  .then(res => console.log('successful'))
  .catch(error => console.error(error))
client.getSchema('doc')
  .then(res => console.log(res.data))

client.search('doc', '"test"')
  .then(res => res.data.forEach((el) => console.log(el)))
  .catch(err => console.error(err))

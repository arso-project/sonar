const makeClient = require('../client')
exports.describe = 'show status info'
exports.command = 'status'
exports.handler = async function (argv) {
  const client = makeClient(argv)
  const result = await client.info()
  console.log(JSON.stringify(result, 0, 2))
}

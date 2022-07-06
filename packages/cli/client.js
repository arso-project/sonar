const { Workspace } = require('@arsonar/client')
const { storagePath } = require('@arsonar/common/storage')
const fs = require('fs')
const p = require('path')

function loadRootAccessCode (argv) {
  if (argv.accessCode) return
  const path = p.join(storagePath(argv.storage), 'tokens.json')
  try {
    const json = fs.readFileSync(path)
    const data = JSON.parse(json)
    if (data && data.rootAccessCode) {
      argv.accessCode = data.rootAccessCode
    }
  } catch (err) {}
}

module.exports = function getClient (argv) {
  loadRootAccessCode(argv)
  const workspace = new Workspace({
    endpoint: argv.endpoint,
    collection: argv.collection,
    accessCode: argv.accessCode,
    // token: argv.token,
    cache: false
  })
  return workspace
}

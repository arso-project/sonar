const Relations = require('./relations')

module.exports = function registerRelationsPlugin (workspace) {
  const relations = new Relations(
    workspace.LevelDB('relations', {
      valueEncoding: 'binary'
    })
  )
  workspace.on('collection-open', collection => {
    collection.use('relations', relations.createView(collection))
  })
}

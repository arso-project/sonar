const Catalog = require('@arso-project/sonar-tantivy')

const createSearchView = require('./src/index.js')

module.exports = function registerSearchPlugin (workspace) {
  const indexCatalog = new Catalog(workspace.storagePath('tantivy'))
  workspace.on('collection-opening', collection => {
    const view = createSearchView(
      collection._leveldb('view/search'),
      null,
      { collection, indexCatalog }
    )
    collection.use('search', view)
  })
  workspace.on('close', () => {
    indexCatalog.close()
  })
}
